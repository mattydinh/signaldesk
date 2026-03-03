import { ingestArticles, type IngestArticle } from "@/lib/ingest";
import { setRssStatus } from "./rss-status-store";
import { fetchAllRssArticles } from "./fetch-rss";

export type FetchNewsResult =
  | { ok: true; created: number; skipped: number; total: number; newArticleIds: string[] }
  | { ok: false; error: string };

/**
 * Fetch headlines from configured RSS feeds and ingest into DB.
 * Used by cron and by "Fetch news now" on the dashboard.
 */
export async function fetchAndIngestNews(): Promise<FetchNewsResult> {
  const timestamp = new Date().toISOString();
  setRssStatus({ lastFetchTimestamp: timestamp, pipelineStage: "fetch" });

  let articles: IngestArticle[];
  try {
    articles = await fetchAllRssArticles();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch from RSS feeds.";
    console.error("[fetch-news] RSS fetch error", e);
    setRssStatus({ lastError: message, pipelineStage: "error" });
    return { ok: false, error: message };
  }

  setRssStatus({ articlesFetchedCount: articles.length, pipelineStage: "dedup" });
  const dates = articles.map((a) => a.publishedAt).filter(Boolean) as string[];
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  console.log("[fetch-news] articles fetched:", articles.length, "dateRange:", minDate, "..", maxDate);

  if (!articles.length) {
    return {
      ok: false,
      error:
        "No articles from RSS feeds. Check RSS_FEEDS configuration and that the feeds are reachable from the deployment.",
    };
  }

  try {
    const result = await ingestArticles(articles);
    setRssStatus({
      articlesInsertedCount: result.created,
      articlesSkippedCount: result.skipped,
      lastError: null,
      pipelineStage: "done",
    });
    console.log("[fetch-news] ingest result: created=", result.created, "skipped=", result.skipped, "total=", result.total);
    return {
      ok: true,
      ...result,
      total: articles.length,
      newArticleIds: result.newArticleIds ?? [],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database ingest failed.";
    console.error("[fetch-news] ingest error", e);
    setRssStatus({ lastError: message, pipelineStage: "error" });
    return { ok: false, error: message };
  }
}
