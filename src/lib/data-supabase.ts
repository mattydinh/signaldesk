/**
 * Data access via Supabase REST API (no direct Postgres connection).
 * Used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, to avoid pooler/tenant issues on Vercel.
 */
import { getSupabaseAdmin } from "./supabase-server";
import { getFeedCache, setFeedCache, type CachedArticle } from "./feed-cache";
import { hasBlobFeed, readFeedFromBlob, writeFeedToBlob } from "./feed-blob";
import { hasKvFeed, readFeedFromKv, writeFeedToKv } from "./feed-kv";
import { inferCategoriesFromText } from "./categories";
import { createEventFromArticle } from "./events";

const SOURCE_TABLE = process.env.SUPABASE_SOURCE_TABLE ?? "Source";
const ARTICLE_TABLE = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";

export type SourceRow = { id: string; name: string; slug: string };
export type ArticleRow = {
  id: string;
  sourceId: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string | null;
  externalId: string | null;
  entities: string[];
  topics: string[];
  categories: string[];
  opportunities: string[];
  implications: string | null;
  forShareholders: string | null;
  forInvestors: string | null;
  forBusiness: string | null;
};

export async function getSourcesSupabase(): Promise<SourceRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const sb = supabase as any;
  const { data, error } = await sb.from(SOURCE_TABLE).select("id, name, slug").order("name", { ascending: true });
  if (error) {
    console.error("[data-supabase] getSources", error);
    return [];
  }
  return (data ?? []) as SourceRow[];
}

/** Try both PascalCase and lowercase table names; PostgREST/Postgres can expose either. */
const ARTICLE_TABLE_ALT = ARTICLE_TABLE === "Article" ? "article" : ARTICLE_TABLE === "article" ? "Article" : null;

/** Default retention: only show articles from the last N days. Set to 0 to disable. */
const DEFAULT_RETENTION_DAYS = 30;

export async function getArticlesSupabase(options: {
  limit: number;
  offset: number;
  sourceId?: string;
  category?: string;
  q?: string;
  /** Only return articles with publishedAt on or after (now - retentionDays). Omit or 0 = no filter. */
  retentionDays?: number;
  /** When set with windowEnd, filter to publishedAt in [windowStart, windowEnd] (ignores retentionDays). */
  windowStart?: string;
  windowEnd?: string;
}): Promise<{ articles: (ArticleRow | CachedArticle)[]; total: number }> {
  const matchCategory = (a: { categories?: string[] }) =>
    !options.category || (Array.isArray(a.categories) && a.categories.includes(options.category!));
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const useWindow = options.windowStart != null && options.windowEnd != null;
  const publishedAfter = useWindow
    ? options.windowStart!
    : retentionDays > 0
      ? new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const publishedBefore = useWindow ? options.windowEnd! : null;

  function sortByNewestFirst<T extends { publishedAt?: string | null }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => {
      const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tB - tA;
    });
  }

  // When Supabase is configured, use it as source of truth (newest first, full table).
  const supabaseFirst = getSupabaseAdmin();
  if (supabaseFirst) {
    const sb = supabaseFirst as any;
    const cols = "id,sourceId,title,summary,url,publishedAt,externalId,entities,topics,categories,opportunities,implications,forShareholders,forInvestors,forBusiness";
    const from = options.offset;
    const to = options.offset + options.limit - 1;
    let q = sb.from(ARTICLE_TABLE).select(cols, { count: "exact" }).order("publishedAt", { ascending: false }).range(from, to);
    if (publishedAfter) q = q.gte("publishedAt", publishedAfter);
    if (publishedBefore) q = q.lte("publishedAt", publishedBefore);
    if (options.sourceId) q = q.eq("sourceId", options.sourceId);
    if (options.category) q = q.contains("categories", [options.category]);
    if (options.q?.trim()) {
      const t = options.q.trim().slice(0, 200);
      const pattern = `%${t.replace(/%/g, "\\%")}%`;
      q = q.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
    }
    let result = await q;
    let data = (result as { data?: unknown }).data;
    let count = typeof (result as { count?: number }).count === "number" ? (result as { count: number }).count : null;
    let err = (result as { error?: unknown }).error;
    if (err && ARTICLE_TABLE_ALT) {
      let qAlt = sb.from(ARTICLE_TABLE_ALT).select(cols, { count: "exact" }).order("publishedAt", { ascending: false }).range(from, to);
      if (publishedAfter) qAlt = qAlt.gte("publishedAt", publishedAfter);
      if (publishedBefore) qAlt = qAlt.lte("publishedAt", publishedBefore);
      if (options.sourceId) qAlt = qAlt.eq("sourceId", options.sourceId);
      if (options.category) qAlt = qAlt.contains("categories", [options.category]);
      if (options.q?.trim()) {
        const t = options.q.trim().slice(0, 200);
        const pattern = `%${t.replace(/%/g, "\\%")}%`;
        qAlt = qAlt.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
      }
      const alt = await qAlt;
      data = (alt as { data?: unknown }).data;
      count = typeof (alt as { count?: number }).count === "number" ? (alt as { count: number }).count : null;
      err = (alt as { error?: unknown }).error;
    }
    if (!err && Array.isArray(data)) {
      const articles = data as ArticleRow[];
      const total = count ?? articles.length;
      const withInferred = articles.map((a) => ({
        ...a,
        categories: a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null),
      }));
      return { articles: withInferred, total };
    }
  }

  if (hasBlobFeed()) {
    const blobFeed = await readFeedFromBlob();
    if (blobFeed && blobFeed.length > 0) {
      let list = blobFeed;
      if (publishedAfter) list = list.filter((a) => !a.publishedAt || a.publishedAt >= publishedAfter);
      if (publishedBefore) list = list.filter((a) => !a.publishedAt || a.publishedAt <= publishedBefore);
      if (options.sourceId) list = list.filter((a) => a.sourceId === options.sourceId);
      if (options.category) {
        list = list.filter((a) => {
          const categories = a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null);
          return categories.includes(options.category!);
        });
      }
      if (options.q?.trim()) {
        const q = options.q.trim().toLowerCase();
        list = list.filter((a) => a.title?.toLowerCase().includes(q) || (a.summary && a.summary.toLowerCase().includes(q)));
      }
      list = sortByNewestFirst(list);
      const total = list.length;
      const articles = list.slice(options.offset, options.offset + options.limit);
      const realIds = articles.filter((a) => !a.id.startsWith("cache-")).map((a) => a.id);
      if (realIds.length > 0) {
        const analysisMap = await getAnalysisBatchSupabase(realIds);
        const merged = articles.map((a) => {
          const analysis = analysisMap.get(a.id);
          const out = analysis ? { ...a, ...analysis } : a;
          const categories = out.categories?.length ? out.categories : inferCategoriesFromText(out.title ?? null, out.summary ?? null);
          return { ...out, categories };
        });
        return { articles: merged, total };
      }
      const withInferred = articles.map((a) => ({
        ...a,
        categories: a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null),
      }));
      return { articles: withInferred, total };
    }
  }
  if (hasKvFeed()) {
    const kvFeed = await readFeedFromKv();
    if (kvFeed && kvFeed.length > 0) {
      let list = kvFeed;
      if (publishedAfter) list = list.filter((a) => !a.publishedAt || a.publishedAt >= publishedAfter);
      if (publishedBefore) list = list.filter((a) => !a.publishedAt || a.publishedAt <= publishedBefore);
      if (options.sourceId) list = list.filter((a) => a.sourceId === options.sourceId);
      if (options.category) {
        list = list.filter((a) => {
          const categories = a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null);
          return categories.includes(options.category!);
        });
      }
      if (options.q?.trim()) {
        const q = options.q.trim().toLowerCase();
        list = list.filter((a) => a.title?.toLowerCase().includes(q) || (a.summary && a.summary.toLowerCase().includes(q)));
      }
      list = sortByNewestFirst(list);
      const total = list.length;
      const articles = list.slice(options.offset, options.offset + options.limit);
      const realIds = articles.filter((a) => !a.id.startsWith("cache-")).map((a) => a.id);
      if (realIds.length > 0) {
        const analysisMap = await getAnalysisBatchSupabase(realIds);
        const merged = articles.map((a) => {
          const analysis = analysisMap.get(a.id);
          const out = analysis ? { ...a, ...analysis } : a;
          const categories = out.categories?.length ? out.categories : inferCategoriesFromText(out.title ?? null, out.summary ?? null);
          return { ...out, categories };
        });
        return { articles: merged, total };
      }
      const withInferred = articles.map((a) => ({
        ...a,
        categories: a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null),
      }));
      return { articles: withInferred, total };
    }
  }

  return { articles: [], total: 0 };
}

export type IngestArticleInput = {
  externalId?: string;
  sourceName: string;
  sourceSlug?: string;
  sourceBaseUrl?: string;
  title: string;
  summary?: string;
  url?: string;
  publishedAt?: string;
  rawPayload?: unknown;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toCachedArticle(
  a: IngestArticleInput,
  id: string,
  sourceId: string
): CachedArticle {
  return {
    id,
    sourceId,
    title: a.title,
    summary: a.summary ?? null,
    url: a.url ?? null,
    publishedAt: a.publishedAt ?? null,
    externalId: a.externalId ?? null,
    entities: [],
    topics: [],
    categories: [],
    opportunities: [],
    implications: null,
    forShareholders: null,
    forInvestors: null,
    forBusiness: null,
    sourceName: a.sourceName,
  };
}

export async function ingestArticlesSupabase(
  articles: IngestArticleInput[]
): Promise<{ created: number; skipped: number; total: number; newArticleIds: string[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { created: 0, skipped: 0, total: articles.length, newArticleIds: [] };
  const sb = supabase as any;

  let created = 0;
  let skipped = 0;
  const newArticleIds: string[] = [];
  const feedEntries: CachedArticle[] = [];

  for (const a of articles) {
    if (!a.title || !a.sourceName) {
      skipped++;
      continue;
    }

    const slug = a.sourceSlug ?? slugify(a.sourceName);

    const { data: existingSource } = await sb.from(SOURCE_TABLE).select("id").eq("slug", slug).maybeSingle();

    const existingId = (existingSource as { id: string } | null)?.id;
    let sourceId: string;
    if (existingId) {
      sourceId = existingId;
    } else {
      const { data: newSource, error: insertSourceErr } = await sb.from(SOURCE_TABLE).insert({ name: a.sourceName, slug, baseUrl: a.sourceBaseUrl ?? null }).select("id").single();
      if (insertSourceErr || !(newSource as { id?: string })?.id) {
        console.error("[data-supabase] insert source", insertSourceErr);
        skipped++;
        continue;
      }
      sourceId = (newSource as { id: string }).id;
    }

    if (a.externalId) {
      const { data: existing } = await sb.from(ARTICLE_TABLE).select("id").eq("sourceId", sourceId).eq("externalId", a.externalId).maybeSingle();
      const existingArticleId = (existing as { id?: string })?.id;
      if (existingArticleId) {
        skipped++;
        feedEntries.push(toCachedArticle(a, existingArticleId, sourceId));
        continue;
      }
    }

    const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
    const { data: newArticle, error: insertErr } = await sb
      .from(ARTICLE_TABLE)
      .insert({
        sourceId,
        externalId: a.externalId ?? null,
        title: a.title,
        summary: a.summary ?? null,
        url: a.url ?? null,
        publishedAt,
        rawPayload: a.rawPayload ?? null,
      })
      .select("id")
      .single();
    if (insertErr || !(newArticle as { id?: string })?.id) {
      console.error("[data-supabase] insert article", insertErr);
      skipped++;
      continue;
    }
    const newId = (newArticle as { id: string }).id;
    created++;
    newArticleIds.push(newId);
    feedEntries.push(toCachedArticle(a, newId, sourceId));
    await createEventFromArticle({
      id: newId,
      title: a.title,
      summary: a.summary ?? null,
      url: a.url ?? null,
      publishedAt: publishedAt ?? undefined,
    });
  }

  if (feedEntries.length > 0) {
    setFeedCache(feedEntries);
    const mergeAndSort = (existing: CachedArticle[] | null): CachedArticle[] => {
      const byId = new Map<string, CachedArticle>(feedEntries.map((a) => [a.id, a]));
      for (const a of existing ?? []) {
        if (!byId.has(a.id)) byId.set(a.id, a);
      }
      return Array.from(byId.values()).sort((a, b) => {
        const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tB - tA;
      });
    };
    if (hasBlobFeed()) {
      const existing = await readFeedFromBlob();
      await writeFeedToBlob(mergeAndSort(existing));
    }
    if (hasKvFeed()) {
      const existing = await readFeedFromKv();
      await writeFeedToKv(mergeAndSort(existing));
    }
  }

  return { created, skipped, total: articles.length, newArticleIds };
}

/** When using Blob/KV, categories live only in Supabase. Return set of article IDs that have the given category. */
async function getArticleIdsByCategorySupabase(category: string): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Set();
  const sb = supabase as any;
  const { data, error } = await sb
    .from(ARTICLE_TABLE)
    .select("id")
    .contains("categories", [category]);
  if (error || !Array.isArray(data)) return new Set();
  return new Set((data as { id: string }[]).map((r) => r.id));
}

/** Fetch analysis fields for multiple article ids (for merging into Blob/Kv feed). */
async function getAnalysisBatchSupabase(
  ids: string[]
): Promise<Map<string, Pick<ArticleRow, "entities" | "topics" | "categories" | "opportunities" | "implications" | "forShareholders" | "forInvestors" | "forBusiness">>> {
  if (ids.length === 0) return new Map();
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Map();
  const sb = supabase as any;
  const { data, error } = await sb
    .from(ARTICLE_TABLE)
    .select("id, entities, topics, categories, opportunities, implications, forShareholders, forInvestors, forBusiness")
    .in("id", ids);
  if (error || !Array.isArray(data)) return new Map();
  const map = new Map<
    string,
    Pick<ArticleRow, "entities" | "topics" | "categories" | "opportunities" | "implications" | "forShareholders" | "forInvestors" | "forBusiness">
  >();
  for (const row of data as Array<ArticleRow & { id: string }>) {
    map.set(row.id, {
      entities: row.entities ?? [],
      topics: row.topics ?? [],
      categories: row.categories ?? [],
      opportunities: row.opportunities ?? [],
      implications: row.implications ?? null,
      forShareholders: row.forShareholders ?? null,
      forInvestors: row.forInvestors ?? null,
      forBusiness: row.forBusiness ?? null,
    });
  }
  return map;
}

export async function getArticleByIdSupabase(id: string): Promise<(ArticleRow & { source: { name: string } }) | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const sb = supabase as any;
  const { data: article, error } = await sb
    .from(ARTICLE_TABLE)
    .select("id, sourceId, title, summary, url, publishedAt, externalId, entities, topics, categories, opportunities, implications, forShareholders, forInvestors, forBusiness")
    .eq("id", id)
    .single();
  if (error || !article) return null;
  const { data: source } = await sb
    .from(SOURCE_TABLE)
    .select("name")
    .eq("id", (article as ArticleRow).sourceId)
    .single();
  return {
    ...(article as ArticleRow),
    source: { name: (source as { name: string } | null)?.name ?? "Unknown" },
  };
}

export async function updateArticleAnalysisSupabase(
  id: string,
  data: {
    entities: string[];
    topics: string[];
    categories: string[];
    opportunities: string[];
    implications: string | null;
    forShareholders: string | null;
    forInvestors: string | null;
    forBusiness: string | null;
  }
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const sb = supabase as any;
  const { error } = await sb.from(ARTICLE_TABLE).update(data).eq("id", id);
  if (error) {
    console.error("[data-supabase] updateArticleAnalysis", error);
    return false;
  }
  return true;
}
