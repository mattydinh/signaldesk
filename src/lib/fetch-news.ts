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
  let lastApiError: string | null = null;
  let anyRequestSucceeded = false;

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
    // Request freshest articles first via "everything" (sortBy=publishedAt, from=last 24h).
    // On free tier in production this may be blocked; we fall back to top-headlines below.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fromParam = yesterday.toISOString().slice(0, 10);
    const freshQuery = "business OR markets OR economy OR finance OR stocks";
    const freshUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(freshQuery)}&language=en&sortBy=publishedAt&pageSize=30&from=${fromParam}&apiKey=${newsApiKey}`;
    const freshRes = await fetch(freshUrl, { cache: "no-store" });
    if (freshRes.ok) {
      anyRequestSucceeded = true;
      const freshRaw = await freshRes.json() as { status: string; articles?: Array<{ source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }> };
      if (freshRaw.status === "ok" && Array.isArray(freshRaw.articles)) {
        for (const a of freshRaw.articles) pushArticle(a);
      }
    } else {
      lastApiError = `News API everything (fresh) ${freshRes.status}`;
      console.error("[fetch-news]", lastApiError, "(everything endpoint may be blocked on free tier in production)");
    }

    for (const category of categories) {
      const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=20&apiKey=${newsApiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.text();
        lastApiError = `News API ${res.status}: ${err.slice(0, 200)}`;
        console.error("[fetch-news]", lastApiError);
        continue;
      }
      anyRequestSucceeded = true;
      const raw = await res.json() as { status: string; articles?: Array<{ source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }> };
      const data = raw;
      if (data.status !== "ok" || !Array.isArray(data.articles)) continue;
      for (const a of data.articles) pushArticle(a);
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 2);
    const fromParam2 = fromDate.toISOString().slice(0, 10);

    for (const { q } of sectorQueries) {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=15&from=${fromParam2}&apiKey=${newsApiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.text();
        if (!lastApiError) lastApiError = `News API everything ${res.status}: ${err.slice(0, 200)}`;
        console.error("[fetch-news] everything", res.status, err.slice(0, 200));
        continue;
      }
      anyRequestSucceeded = true;
      const raw = await res.json() as { status: string; articles?: Array<{ source?: { id?: string; name?: string }; title?: string; description?: string; url?: string; publishedAt?: string }> };
      if (raw.status !== "ok" || !Array.isArray(raw.articles)) continue;
      for (const a of raw.articles) pushArticle(a);
    }

    if (allArticles.length > 0) {
      const dates = allArticles.map((a) => (a.publishedAt ? new Date(a.publishedAt).getTime() : 0)).filter((t) => t > 0);
      if (dates.length > 0) {
        const min = new Date(Math.min(...dates)).toISOString().slice(0, 10);
        const max = new Date(Math.max(...dates)).toISOString().slice(0, 10);
        console.error("[fetch-news] Fetched", allArticles.length, "articles, date range:", min, "to", max);
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch from News API.";
    console.error("[fetch-news] fetch error", e);
    return { ok: false, error: message };
  }

  if (allArticles.length === 0) {
    if (lastApiError || !anyRequestSucceeded) {
      return {
        ok: false,
        error:
          lastApiError ??
          "News API returned no articles. The free tier only works in development; production requires a paid plan at newsapi.org. Add NEWS_API_KEY in Vercel and ensure your plan allows production use.",
      };
    }
    return { ok: true, created: 0, skipped: 0, total: 0, newArticleIds: [] };
  }

  try {
    const result = await ingestArticles(allArticles);
    return { ok: true, ...result, newArticleIds: result.newArticleIds ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database ingest failed.";
    console.error("[fetch-news] ingest error", e);
    return { ok: false, error: message };
  }
}
