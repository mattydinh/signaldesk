/**
 * In-memory fallback for the article list when Supabase list query returns 0 or 1 row.
 * Populated by ingest; used by dashboard when DB list is broken. Per-instance only (resets on cold start).
 */
import type { ArticleRow } from "./data-supabase";

export type CachedArticle = ArticleRow & { sourceName: string };

let cache: CachedArticle[] = [];
const MAX_CACHED = 100;

export function setFeedCache(articles: CachedArticle[]): void {
  if (!Array.isArray(articles)) return;
  cache = articles.slice(0, MAX_CACHED);
}

export function getFeedCache(): CachedArticle[] {
  return cache.slice();
}

export function getFeedCacheLength(): number {
  return cache.length;
}
