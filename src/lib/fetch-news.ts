import { ingestArticles, type IngestArticle } from "@/lib/ingest";

export type FetchNewsResult =
  | { ok: true; created: number; skipped: number; total: number }
  | { ok: false; error: string };

/**
 * Fetch US business + general headlines from News API and ingest into DB.
 * Requires NEWS_API_KEY. Used by cron and by "Fetch news now" on dashboard.
 */
export async function fetchAndIngestNews(): Promise<FetchNewsResult> {
  const newsApiKey = process.env.NEWS_API_KEY;
  if (!newsApiKey) {
    return { ok: false, error: "NEWS_API_KEY is not set. Add it in Vercel → Settings → Environment Variables (get a key at newsapi.org)." };
  }

  const categories = ["business", "general"] as const;
  const allArticles: IngestArticle[] = [];
  const seen = new Set<string>();

  try {
    for (const category of categories) {
      const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=20&apiKey=${newsApiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.text();
        console.error("[fetch-news] News API error", res.status, err);
        continue;
      }
      const raw = await res.json() as { status: string; articles?: Array<{ source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }> };
      const data = raw;
      if (data.status !== "ok" || !Array.isArray(data.articles)) continue;

      for (const a of data.articles) {
        if (!a.title) continue;
        const dedupe = `${a.source?.id ?? "unknown"}-${a.title}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        allArticles.push({
          externalId: a.url ?? undefined,
          sourceName: a.source?.name ?? "Unknown",
          sourceSlug: a.source?.id ?? undefined,
          title: a.title,
          summary: a.description ?? undefined,
          url: a.url ?? undefined,
          publishedAt: a.publishedAt ?? undefined,
          rawPayload: a,
        });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch from News API.";
    console.error("[fetch-news] fetch error", e);
    return { ok: false, error: message };
  }

  if (allArticles.length === 0) {
    return { ok: true, created: 0, skipped: 0, total: 0 };
  }

  try {
    const result = await ingestArticles(allArticles);
    return { ok: true, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database ingest failed.";
    console.error("[fetch-news] ingest error", e);
    return { ok: false, error: message };
  }
}
