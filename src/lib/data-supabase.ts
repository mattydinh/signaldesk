/**
 * Data access via Supabase REST API (no direct Postgres connection).
 * Used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, to avoid pooler/tenant issues on Vercel.
 */
import { getSupabaseAdmin } from "./supabase-server";

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

export async function getArticlesSupabase(options: {
  limit: number;
  offset: number;
  sourceId?: string;
  q?: string;
}): Promise<{ articles: ArticleRow[]; total: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { articles: [], total: 0 };
  const sb = supabase as any;
  let q = sb.from(ARTICLE_TABLE).select("id, sourceId, title, summary, url, publishedAt, externalId, entities, topics, opportunities, implications, forShareholders, forInvestors, forBusiness", { count: "exact" });
  if (options.sourceId) q = q.eq("sourceId", options.sourceId);
  if (options.q?.trim()) {
    const t = options.q.trim().slice(0, 200);
    const pattern = `%${t.replace(/%/g, "\\%")}%`;
    q = q.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
  }
  const result = await q.order("publishedAt", { ascending: false, nullsFirst: false }).range(options.offset, options.offset + options.limit - 1);
  const { data, error, count } = result;
  if (error) {
    console.error("[data-supabase] getArticles", error);
    return { articles: [], total: 0 };
  }
  return { articles: (data ?? []) as ArticleRow[], total: count ?? 0 };
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

export async function ingestArticlesSupabase(
  articles: IngestArticleInput[]
): Promise<{ created: number; skipped: number; total: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { created: 0, skipped: 0, total: articles.length };
  const sb = supabase as any;

  let created = 0;
  let skipped = 0;

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
      if ((existing as { id?: string })?.id) {
        skipped++;
        continue;
      }
    }

    const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
    const { error: insertErr } = await sb.from(ARTICLE_TABLE).insert({
      sourceId,
      externalId: a.externalId ?? null,
      title: a.title,
      summary: a.summary ?? null,
      url: a.url ?? null,
      publishedAt,
      rawPayload: a.rawPayload ?? null,
    });
    if (insertErr) {
      console.error("[data-supabase] insert article", insertErr);
      skipped++;
      continue;
    }
    created++;
  }

  return { created, skipped, total: articles.length };
}

export async function getArticleByIdSupabase(id: string): Promise<(ArticleRow & { source: { name: string } }) | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const sb = supabase as any;
  const { data: article, error } = await sb
    .from(ARTICLE_TABLE)
    .select("id, sourceId, title, summary, url, publishedAt, externalId, entities, topics, opportunities, implications, forShareholders, forInvestors, forBusiness")
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
