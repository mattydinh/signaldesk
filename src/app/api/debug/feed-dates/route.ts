import { NextRequest, NextResponse } from "next/server";
import { fetchAllRssArticles } from "@/lib/fetch-rss";

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
 * GET /api/debug/feed-dates — inspect raw RSS fetched article dates.
 * Answers: are feeds returning 3/1–3/2 or only 2/27 and earlier?
 * In production, requires CRON_SECRET in ?secret= or Authorization: Bearer.
 */
export async function GET(request: NextRequest) {
  if (!allowDebug(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let articles: Awaited<ReturnType<typeof fetchAllRssArticles>>;
  try {
    articles = await fetchAllRssArticles();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const withDate = articles.map((a) => ({
    ...a,
    _ts: a.publishedAt ? new Date(a.publishedAt).getTime() : 0,
  }));
  const sorted = [...withDate].sort((a, b) => b._ts - a._ts);

  const bySource: Record<
    string,
    { count: number; minDate: string | null; maxDate: string | null }
  > = {};
  for (const a of articles) {
    const name = a.sourceName ?? "unknown";
    if (!bySource[name]) {
      bySource[name] = { count: 0, minDate: null, maxDate: null };
    }
    bySource[name].count++;
    if (a.publishedAt) {
      if (!bySource[name].minDate || a.publishedAt < bySource[name].minDate!)
        bySource[name].minDate = a.publishedAt;
      if (!bySource[name].maxDate || a.publishedAt > bySource[name].maxDate!)
        bySource[name].maxDate = a.publishedAt;
    }
  }

  const dates = articles
    .map((a) => a.publishedAt)
    .filter((d): d is string => !!d);
  const overallMin = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const overallMax = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  const latest = sorted.slice(0, 40).map((a) => ({
    title: a.title?.slice(0, 80),
    publishedAt: a.publishedAt,
    url: a.url?.slice(0, 100),
    externalId: a.externalId?.startsWith("gen:") ? a.externalId.slice(0, 50) + "…" : (a.externalId ?? null),
    sourceName: a.sourceName,
  }));

  const genCount = articles.filter((a) => a.externalId?.startsWith("gen:")).length;
  const urlCount = articles.length - genCount;

  return NextResponse.json({
    ok: true,
    totalFetched: articles.length,
    externalIdBreakdown: { urlBased: urlCount, generatedFallback: genCount },
    bySource,
    overall: {
      count: articles.length,
      minDate: overallMin,
      maxDate: overallMax,
    },
    latest,
    hint: "If maxDate is 2/27 or earlier, feeds are stale. If maxDate is 3/1–3/2 and ingest still skips all, dedup is too aggressive.",
  });
}
