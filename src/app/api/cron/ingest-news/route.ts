import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestNews } from "@/lib/fetch-news";

const ANALYZE_BATCH = 3;
const ANALYZE_DELAY_MS = 400;

/**
 * GET /api/cron/ingest-news
 * Fetches business + general headlines from News API, ingests them, and auto-tags new articles.
 * Call with CRON_SECRET in query or header to authorize.
 * Set NEWS_API_KEY and CRON_SECRET in env. Set GROQ_API_KEY or OPENAI_API_KEY to auto-tag new articles.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const result = await fetchAndIngestNews();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("NEWS_API_KEY") ? 503 : 500 }
    );
  }

  const newIds = result.newArticleIds ?? [];
  const hasAnalyze = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  if (hasAnalyze && newIds.length > 0) {
    const origin = request.nextUrl.origin;
    for (let i = 0; i < newIds.length; i += ANALYZE_BATCH) {
      const batch = newIds.slice(i, i + ANALYZE_BATCH);
      await Promise.all(
        batch.map((id) =>
          fetch(`${origin}/api/articles/${id}/analyze`, { method: "POST" }).catch(() => null)
        )
      );
      if (i + ANALYZE_BATCH < newIds.length) {
        await new Promise((r) => setTimeout(r, ANALYZE_DELAY_MS));
      }
    }
  }

  return NextResponse.json(result);
}
