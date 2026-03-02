#!/usr/bin/env node
/**
 * Run from your machine (development) so News API free tier accepts the requests.
 * Fetches from News API and POSTs articles to your deployed app's ingest endpoint.
 *
 * Usage:
 *   NEWS_API_KEY=your_key node scripts/fetch-news-dev.mjs
 *   NEWS_API_KEY=your_key INGEST_URL=https://signaldesk-chi.vercel.app INGEST_API_KEY=secret node scripts/fetch-news-dev.mjs
 *
 * Set INGEST_API_KEY in Vercel and pass it here so only your script can POST.
 */

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const INGEST_URL = (process.env.INGEST_URL || "https://signaldesk-chi.vercel.app").replace(/\/$/, "");
const INGEST_API_KEY = process.env.INGEST_API_KEY;

if (!NEWS_API_KEY) {
  console.error("Set NEWS_API_KEY (e.g. export NEWS_API_KEY=your_key)");
  process.exit(1);
}

const allArticles = [];
const seen = new Set();

function push(a) {
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
  });
}

async function main() {
  const categories = ["business", "general"];
  const sectorQueries = [
    { q: "FDA drug approval pharma" },
    { q: "oil OPEC energy crude" },
  ];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const from1 = yesterday.toISOString().slice(0, 10);
  const from2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Fresh "everything" (newest first)
  const freshUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent("business OR markets OR economy OR finance OR stocks")}&language=en&sortBy=publishedAt&pageSize=30&from=${from1}&apiKey=${NEWS_API_KEY}`;
  try {
    const r = await fetch(freshUrl);
    if (r.ok) {
      const data = await r.json();
      if (data.status === "ok" && Array.isArray(data.articles)) data.articles.forEach(push);
    }
  } catch (e) {
    console.warn("Fresh everything:", e.message);
  }

  for (const category of categories) {
    const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=20&apiKey=${NEWS_API_KEY}`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        if (data.status === "ok" && Array.isArray(data.articles)) data.articles.forEach(push);
      }
    } catch (e) {
      console.warn(`Top-headlines ${category}:`, e.message);
    }
  }

  for (const { q } of sectorQueries) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=15&from=${from2}&apiKey=${NEWS_API_KEY}`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        if (data.status === "ok" && Array.isArray(data.articles)) data.articles.forEach(push);
      }
    } catch (e) {
      console.warn(`Everything ${q}:`, e.message);
    }
  }

  if (allArticles.length === 0) {
    const msg =
      "No articles fetched. In CI (e.g. GitHub Actions), News API free tier often blocks requests—run the script locally (npm run fetch-news:dev) to get articles.";
    if (process.env.CI === "true") {
      console.warn(msg);
      process.exit(0);
    }
    console.error(msg);
    process.exit(1);
  }

  const dates = allArticles.map((a) => (a.publishedAt ? new Date(a.publishedAt).getTime() : 0)).filter(Boolean);
  const min = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : "—";
  const max = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "—";
  console.log(`Fetched ${allArticles.length} articles (${min} to ${max}). Posting to ${INGEST_URL}/api/news/ingest ...`);

  const headers = { "Content-Type": "application/json" };
  if (INGEST_API_KEY) headers["x-api-key"] = INGEST_API_KEY;

  const ingestRes = await fetch(`${INGEST_URL}/api/news/ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify({ articles: allArticles }),
  });

  const body = await ingestRes.json().catch(() => ({}));
  if (!ingestRes.ok) {
    console.error("Ingest failed:", ingestRes.status, body);
    process.exit(1);
  }
  console.log("Ingest ok:", body.created, "new,", body.skipped, "already existed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
