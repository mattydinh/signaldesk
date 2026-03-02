import { ingestArticles, type IngestArticle } from "@/lib/ingest";
import { fetchAllRssArticles } from "./fetch-rss";

export type FetchNewsResult =
  | { ok: true; created: number; skipped: number; total: number; newArticleIds: string[] }
  | { ok: false; error: string };

/**
 * Fetch headlines from configured RSS feeds and ingest into DB.
 * Used by cron and by "Fetch news now" on the dashboard.
 */
export async function fetchAndIngestNews(): Promise<FetchNewsResult> {
  let articles: IngestArticle[];
  try {
    articles = await fetchAllRssArticles();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch from RSS feeds.";
    console.error("[fetch-news] RSS fetch error", e);
    return { ok: false, error: message };
  }

  if (!articles.length) {
    return {
      ok: false,
      error:
        "No articles from RSS feeds. Check RSS_FEEDS configuration and that the feeds are reachable from the deployment.",
    };
  }

  try {
    const result = await ingestArticles(articles);
    return {
      ok: true,
      ...result,
      total: articles.length,
      newArticleIds: result.newArticleIds ?? [],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database ingest failed.";
    console.error("[fetch-news] ingest error", e);
    return { ok: false, error: message };
  }
}
