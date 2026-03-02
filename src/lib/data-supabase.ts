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
/** Try lowercase table names; Supabase/PostgREST often exposes tables as lowercase. */
const SOURCE_TABLE_ALT = SOURCE_TABLE === "Source" ? "source" : SOURCE_TABLE === "source" ? "Source" : null;

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
  type Err = { message?: string; code?: string } | null;
  let result = await sb.from(SOURCE_TABLE).select("id, name, slug").order("name", { ascending: true });
  let data = (result as { data?: unknown }).data;
  let error: Err = (result as { error?: Err }).error ?? null;
  if (error && SOURCE_TABLE_ALT) {
    result = await sb.from(SOURCE_TABLE_ALT).select("id, name, slug").order("name", { ascending: true });
    data = (result as { data?: unknown }).data;
    error = (result as { error?: Err }).error ?? null;
  }
  if (error) {
    console.error("[data-supabase] getSources", error?.message ?? error, error?.code);
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

  /** Keep one article per URL (or id if no url) so the feed has no duplicate entries. */
  function dedupeByUrl<T extends { id: string; url?: string | null }>(articles: T[]): T[] {
    const seen = new Set<string>();
    return articles.filter((a) => {
      const key = (a.url?.trim() || a.id).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Keep one article per (title, sourceId, publishedAt) to avoid many identical headlines from dupes. */
  function dedupeByTitleSourceDate<T extends { id: string; title?: string | null; sourceId: string; publishedAt?: string | null }>(articles: T[]): T[] {
    const seen = new Set<string>();
    return articles.filter((a) => {
      const title = (a.title ?? "").trim().slice(0, 200);
      const date = a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : "";
      const key = `${title.toLowerCase()}|${a.sourceId}|${date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // When Supabase is configured, use it as source of truth (newest first, full table).
  const supabaseFirst = getSupabaseAdmin();
  if (supabaseFirst) {
    const sb = supabaseFirst as any;
    const cols = "id,sourceId,title,summary,url,publishedAt,externalId,entities,topics,categories,opportunities,implications,forShareholders,forInvestors,forBusiness";
    // Fetch extra rows so after dedupe we still have enough for the page (handles duplicate titles in DB).
    const fetchSize = Math.min(200, Math.max(options.limit * 3, options.offset + options.limit * 2));
    const from = 0;
    const to = fetchSize - 1;
    let q = sb.from(ARTICLE_TABLE).select(cols, { count: "exact" }).order("publishedAt", { ascending: false }).order("id", { ascending: false }).range(from, to);
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
      let qAlt = sb.from(ARTICLE_TABLE_ALT).select(cols, { count: "exact" }).order("publishedAt", { ascending: false }).order("id", { ascending: false }).range(from, to);
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
      const withInferred = articles.map((a) => ({
        ...a,
        categories: a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null),
      }));
      // Dedupe by id (same row twice), then url, then title+source+date so one card per logical article.
      const byId = Array.from(new Map(withInferred.map((a) => [a.id, a])).values());
      const dedupedUrl = dedupeByUrl(byId);
      const dedupedLogical = dedupeByTitleSourceDate(dedupedUrl);
      const paged = dedupedLogical.slice(options.offset, options.offset + options.limit);
      return { articles: paged, total: count ?? dedupedLogical.length };
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
      list = dedupeByUrl(list);
      list = dedupeByTitleSourceDate(list);
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
      list = dedupeByUrl(list);
      list = dedupeByTitleSourceDate(list);
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

  const validArticles = articles.filter((a) => a.title && a.sourceName);
  let skipped = articles.length - validArticles.length;
  let created = 0;
  const newArticleIds: string[] = [];
  const feedEntries: CachedArticle[] = [];

  // ── 1. Batch-resolve sources: one SELECT for all unique slugs ──
  const sourceIdCache = new Map<string, string>(); // slug → id
  const uniqueSlugs = Array.from(new Set(validArticles.map((a) => a.sourceSlug ?? slugify(a.sourceName))));
  const sourceTables = [SOURCE_TABLE, SOURCE_TABLE_ALT, "sources"].filter(Boolean) as string[];
  let resolvedSourceTable: string | null = null;
  for (const t of sourceTables) {
    const res = await sb.from(t).select("id, slug").in("slug", uniqueSlugs);
    if (!res.error && Array.isArray(res.data)) {
      resolvedSourceTable = t;
      for (const s of res.data as { id: string; slug: string }[]) sourceIdCache.set(s.slug, s.id);
      break;
    }
  }
  // Insert only the missing sources (usually 0; new sources are rare)
  for (const slug of uniqueSlugs.filter((s) => !sourceIdCache.has(s))) {
    const a = validArticles.find((a) => (a.sourceSlug ?? slugify(a.sourceName)) === slug)!;
    const payload = { name: a.sourceName, slug, baseUrl: a.sourceBaseUrl ?? null };
    const tables = resolvedSourceTable ? [resolvedSourceTable] : sourceTables;
    for (const t of tables) {
      const res = await sb.from(t).insert(payload).select("id").single();
      if (!res.error && (res.data as any)?.id) {
        sourceIdCache.set(slug, (res.data as any).id);
        break;
      }
      console.error("[data-supabase] insert source failed", t, (res.error as any)?.message);
    }
  }

  const canProcess = validArticles.filter((a) => sourceIdCache.has(a.sourceSlug ?? slugify(a.sourceName)));
  skipped += validArticles.length - canProcess.length;

  // ── 2. Batch dedup: one SELECT for all externalIds ──
  const externalIds = Array.from(new Set(canProcess.map((a) => a.externalId).filter(Boolean) as string[]));
  const existingSet = new Set<string>(); // externalIds already in DB
  const existingIdMap = new Map<string, string>(); // externalId → article DB id
  if (externalIds.length > 0) {
    const articleTables = [ARTICLE_TABLE, ARTICLE_TABLE_ALT, "articles"].filter(Boolean) as string[];
    for (const t of articleTables) {
      const res = await sb.from(t).select("id, externalId").in("externalId", externalIds);
      if (!res.error && Array.isArray(res.data)) {
        for (const row of res.data as { id: string; externalId: string }[]) {
          if (row.externalId) {
            existingSet.add(row.externalId);
            existingIdMap.set(row.externalId, row.id);
          }
        }
        break;
      }
    }
  }

  // Partition into existing (skip) vs. new (insert)
  const toInsert: IngestArticleInput[] = [];
  for (const a of canProcess) {
    const sourceId = sourceIdCache.get(a.sourceSlug ?? slugify(a.sourceName))!;
    if (a.externalId && existingSet.has(a.externalId)) {
      skipped++;
      feedEntries.push(toCachedArticle(a, existingIdMap.get(a.externalId)!, sourceId));
      continue;
    }
    toInsert.push(a);
  }

  // ── 3. Batch insert all new articles in one query ──
  if (toInsert.length > 0) {
    const makeRows = (snake: boolean) =>
      toInsert.map((a) => {
        const sourceId = sourceIdCache.get(a.sourceSlug ?? slugify(a.sourceName))!;
        const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
        return snake
          ? { source_id: sourceId, external_id: a.externalId ?? null, title: a.title, summary: a.summary ?? null, url: a.url ?? null, published_at: publishedAt, raw_payload: a.rawPayload ?? null }
          : { sourceId, externalId: a.externalId ?? null, title: a.title, summary: a.summary ?? null, url: a.url ?? null, publishedAt: publishedAt, rawPayload: a.rawPayload ?? null };
      });

    const articleTables = [ARTICLE_TABLE, ARTICLE_TABLE_ALT, "articles"].filter(Boolean) as string[];
    let insertedRows: { id: string; externalId?: string; external_id?: string }[] | null = null;
    outer: for (const t of articleTables) {
      for (const snake of [false, true]) {
        const res = await sb.from(t).insert(makeRows(snake)).select("id, externalId, external_id");
        if (!res.error && Array.isArray(res.data)) {
          insertedRows = res.data;
          break outer;
        }
        const msg = String((res.error as any)?.message ?? "");
        const isColErr = msg.includes("column") || msg.includes("does not exist");
        if (!isColErr) break; // not a column error — try next table name
      }
    }

    // If batch failed, fall back to individual inserts
    if (!insertedRows) {
      console.error("[data-supabase] batch insert failed; falling back to per-article inserts");
      for (const a of toInsert) {
        const sourceId = sourceIdCache.get(a.sourceSlug ?? slugify(a.sourceName))!;
        const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
        const row = { sourceId, externalId: a.externalId ?? null, title: a.title, summary: a.summary ?? null, url: a.url ?? null, publishedAt, rawPayload: a.rawPayload ?? null };
        let res = await sb.from(ARTICLE_TABLE).insert(row).select("id").single();
        if (res.error && ARTICLE_TABLE_ALT) res = await sb.from(ARTICLE_TABLE_ALT).insert(row).select("id").single();
        if (res.error && ARTICLE_TABLE !== "articles") res = await sb.from("articles").insert(row).select("id").single();
        if (!res.error && (res.data as any)?.id) {
          const newId = (res.data as any).id;
          created++;
          newArticleIds.push(newId);
          feedEntries.push(toCachedArticle(a, newId, sourceId));
          await createEventFromArticle({ id: newId, title: a.title, summary: a.summary ?? null, url: a.url ?? null, publishedAt: publishedAt ?? undefined });
        } else {
          skipped++;
        }
      }
    } else {
      // Correlate inserted rows back to articles via externalId
      const extIdToArticle = new Map<string, IngestArticleInput>();
      for (const a of toInsert) if (a.externalId) extIdToArticle.set(a.externalId, a);

      for (const row of insertedRows) {
        const extId = row.externalId ?? row.external_id ?? null;
        const a = extId ? extIdToArticle.get(extId) : toInsert.find((x) => !x.externalId);
        if (!a) continue;
        const sourceId = sourceIdCache.get(a.sourceSlug ?? slugify(a.sourceName))!;
        const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
        created++;
        newArticleIds.push(row.id);
        feedEntries.push(toCachedArticle(a, row.id, sourceId));
        await createEventFromArticle({ id: row.id, title: a.title, summary: a.summary ?? null, url: a.url ?? null, publishedAt: publishedAt ?? undefined });
      }
    }
  }

  // ── 4. Update feed cache ──
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
