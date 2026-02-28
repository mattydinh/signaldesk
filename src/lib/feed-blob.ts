/**
 * Feed list stored in Vercel Blob. Used when Supabase list returns 0–1 row.
 * Set BLOB_READ_WRITE_TOKEN in Vercel (Storage → Blob) to enable.
 */
import { put, get } from "@vercel/blob";
import type { CachedArticle } from "./feed-cache";

const FEED_PATH = "signaldesk/feed/articles.json";
const MAX_ARTICLES = 100;

function hasBlobToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function hasBlobFeed(): boolean {
  return hasBlobToken();
}

/** Write the article list to Blob (call after ingest). */
export async function writeFeedToBlob(articles: CachedArticle[]): Promise<void> {
  if (!hasBlobToken() || !Array.isArray(articles) || articles.length === 0) return;
  try {
    const body = JSON.stringify(articles.slice(0, MAX_ARTICLES));
    await put(FEED_PATH, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("[feed-blob] writeFeedToBlob", e);
  }
}

/** Read the article list from Blob. Returns null if not configured or missing. */
export async function readFeedFromBlob(): Promise<CachedArticle[] | null> {
  if (!hasBlobToken()) return null;
  try {
    const result = await get(FEED_PATH, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const length = chunks.reduce((acc, c) => acc + c.length, 0);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const text = new TextDecoder().decode(bytes);
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? (data as CachedArticle[]) : null;
  } catch {
    return null;
  }
}
