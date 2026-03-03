import { NextRequest, NextResponse } from "next/server";
import { fetchAllRssArticles } from "@/lib/fetch-rss";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getRssStatus } from "@/lib/rss-status-store";

export const dynamic = "force-dynamic";

function allowDebug(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim() ??
    request.nextUrl.searchParams.get("secret")?.trim();
  return provided === secret;
}

/**
 * GET /api/debug/rss-status
 * Returns last fetch/ingest state and optionally runs a live diagnostic.
 * Use ?run=1 to run a fresh RSS fetch (no ingest) and check how many externalIds exist in DB.
 */
export async function GET(request: NextRequest) {
  if (!allowDebug(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runLive = request.nextUrl.searchParams.get("run") === "1";
  const status = getRssStatus();

  const base = {
    last_fetch_timestamp: status?.lastFetchTimestamp ?? null,
    articles_fetched_count: status?.articlesFetchedCount ?? null,
    articles_inserted_count: status?.articlesInsertedCount ?? null,
    articles_skipped_count: status?.articlesSkippedCount ?? null,
    last_error: status?.lastError ?? null,
    pipeline_stage: status?.pipelineStage ?? null,
    hint: "Run a fetch (dashboard button or /api/cron/run-all) then refresh. Use ?run=1 for live diagnostic.",
  };

  if (!runLive) {
    return NextResponse.json({ ok: true, ...base });
  }

  // Live diagnostic: fetch RSS, check how many externalIds exist in DB
  let articlesFetched = 0;
  let externalIdsInDb = 0;
  let dateRange: { min: string | null; max: string | null } = { min: null, max: null };
  let diagnosticError: string | null = null;

  try {
    const articles = await fetchAllRssArticles();
    articlesFetched = articles.length;

    const dates = articles.map((a) => a.publishedAt).filter(Boolean) as string[];
    if (dates.length > 0) {
      dateRange = {
        min: dates.reduce((a, b) => (a < b ? a : b)),
        max: dates.reduce((a, b) => (a > b ? a : b)),
      };
    }

    const sb = getSupabaseAdmin();
    if (sb && articles.length > 0) {
      const externalIds = Array.from(
        new Set(articles.map((a) => a.externalId).filter(Boolean) as string[])
      );
      const ARTICLE_TABLE = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";
      const ARTICLE_ALT = ARTICLE_TABLE === "Article" ? "article" : "Article";
      const CHUNK = 80;
      const found = new Set<string>();

      outer: for (const col of ["externalId", "external_id"]) {
        let ok = true;
        for (let i = 0; i < externalIds.length && ok; i += CHUNK) {
          const chunk = externalIds.slice(i, i + CHUNK);
          let res = await (sb as any).from(ARTICLE_TABLE).select(`id, ${col}`).in(col, chunk);
          if (res.error) {
            res = await (sb as any).from(ARTICLE_ALT).select(`id, ${col}`).in(col, chunk);
            if (res.error) {
              ok = false;
              break;
            }
          }
          for (const row of res.data ?? []) {
            const v = String((row as any)[col] ?? "").trim();
            if (v) found.add(v);
          }
        }
        if (ok) break outer;
      }
      externalIdsInDb = found.size;
    }
  } catch (e) {
    diagnosticError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: true,
    ...base,
    live_diagnostic: {
      articles_fetched: articlesFetched,
      external_ids_in_db: externalIdsInDb,
      date_range: dateRange,
      would_insert: articlesFetched - externalIdsInDb,
      error: diagnosticError,
    },
    hint:
      externalIdsInDb === articlesFetched && articlesFetched > 0
        ? "All fetched externalIds already exist in DB → dedup is working but no new articles to add."
        : externalIdsInDb === 0 && articlesFetched > 0
          ? "No externalIds found in DB → SELECT may be failing (column naming?) or table empty."
          : base.hint,
  });
}
