import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestNews } from "@/lib/fetch-news";

/**
 * GET /api/cron/ingest-news
 * Fetches business + general headlines from News API and ingests them.
 * Call with CRON_SECRET in query or header to authorize.
 * Set NEWS_API_KEY and CRON_SECRET in env. Vercel Cron can hit this on a schedule.
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
  return NextResponse.json({ ok: true, ...result });
}
