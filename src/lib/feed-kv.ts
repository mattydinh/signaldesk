/**
 * Feed list stored in Vercel KV (Upstash Redis). Alternative to Blob.
 * Set KV_REST_API_URL and KV_REST_API_TOKEN (e.g. via Upstash Redis integration) to enable.
 */
import type { CachedArticle } from "./feed-cache";

const FEED_KEY = "signaldesk:feed";
const MAX_ARTICLES = 100;

function hasKvEnv(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export function hasKvFeed(): boolean {
  return hasKvEnv();
}

/** Write the article list to KV (call after ingest). */
export async function writeFeedToKv(articles: CachedArticle[]): Promise<void> {
  if (!hasKvEnv() || !Array.isArray(articles) || articles.length === 0) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(FEED_KEY, JSON.stringify(articles.slice(0, MAX_ARTICLES)));
  } catch (e) {
    console.error("[feed-kv] writeFeedToKv", e);
  }
}

/** Read the article list from KV. Returns null if not configured or missing. */
export async function readFeedFromKv(): Promise<CachedArticle[] | null> {
  if (!hasKvEnv()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.get<string>(FEED_KEY);
    if (raw == null) return null;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(data) ? (data as CachedArticle[]) : null;
  } catch {
    return null;
  }
}
