import { NextRequest, NextResponse } from "next/server";
import { ingestArticles, type IngestArticle } from "@/lib/ingest";

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

  const newsApiKey = process.env.NEWS_API_KEY;
  if (!newsApiKey) {
    return NextResponse.json(
      { error: "NEWS_API_KEY is not set. Get one at newsapi.org." },
      { status: 503 }
    );
  }

  try {
    const categories = ["business", "general"] as const;
    const allArticles: IngestArticle[] = [];
    const seen = new Set<string>();

    for (const category of categories) {
      const url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=20&apiKey=${newsApiKey}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) {
        const err = await res.text();
        console.error("[cron/ingest-news] News API error", res.status, err);
        continue;
      }
      const data = (await res.json()) as {
        status: string;
        articles?: Array<{
          source?: { id?: string; name?: string };
          author?: string;
          title?: string;
          description?: string;
          url?: string;
          publishedAt?: string;
        }>;
      };
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

    if (allArticles.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: 0, total: 0, message: "No articles to ingest." });
    }

    const result = await ingestArticles(allArticles);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/ingest-news]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron ingestion failed." },
      { status: 500 }
    );
  }
}
