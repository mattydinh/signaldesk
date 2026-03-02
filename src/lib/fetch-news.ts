import { ingestArticles, type IngestArticle } from "@/lib/ingest";

export type FetchNewsResult =
  | { ok: true; created: number; skipped: number; total: number; newArticleIds: string[] }
  | { ok: false; error: string };

/**
 * Fetch US business + general headlines from News API and ingest into DB.
 * Requires NEWS_API_KEY. Used by cron and by "Fetch news now" on dashboard.
 */
export async function fetchAndIngestNews(): Promise<FetchNewsResult> {
  const newsApiKey = process.env.NEWS_API_KEY;
  if (!newsApiKey) {
    return {
      ok: false,
      error:
        "NEWS_API_KEY is not set. For local dev add it to .env; for production add it in Vercel → Settings → Environment Variables (get a key at newsapi.org).",
    };
  }

  const categories = ["business", "general"] as const;
  /** Sector "everything" queries to get more pharma/energy articles for signals. */
  const sectorQueries = [
    { q: "FDA drug approval pharma", label: "pharma" },
    { q: "oil OPEC energy crude", label: "energy" },
  ] as const;
  const allArticles: IngestArticle[] = [];
  const seen = new Set<string>();

  function pushArticle(a: { source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }) {
    if (!a.title) return;
    const dedupe = `${a.source?.id ?? "unknown"}-${a.title}`;
    if (seen.has(dedupe)) return;
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

      for (const a of data.articles) pushArticle(a);
    }

    for (const { q } of sectorQueries) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=15&apiKey=${newsApiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const raw = await res.json() as { status: string; articles?: Array<{ source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }> };
      if (raw.status !== "ok" || !Array.isArray(raw.articles)) continue;
      for (const a of raw.articles) pushArticle(a);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch from News API.";
    console.error("[fetch-news] fetch error", e);
    return { ok: false, error: message };
  }

  if (allArticles.length === 0) {
    return { ok: true, created: 0, skipped: 0, total: 0, newArticleIds: [] };
  }

  try {
    const result = await ingestArticles(allArticles);
    // Run ML pipeline in background to populate Intelligence (best-effort; don't block response)
    import("@/lib/pipeline/run").then(({ runPipeline }) =>
      runPipeline().catch((err) => console.error("[fetch-news] pipeline", err))
    );
    return { ok: true, ...result, newArticleIds: result.newArticleIds ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database ingest failed.";
    console.error("[fetch-news] ingest error", e);
    return { ok: false, error: message };
  }
}
