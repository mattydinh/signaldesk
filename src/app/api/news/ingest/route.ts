import { NextRequest, NextResponse } from "next/server";
import { ingestArticles, type IngestArticle } from "@/lib/ingest";

/**
 * News Ingestion API
 * POST /api/news/ingest — accept articles and store them
 * Body: { articles: IngestArticle[] }
 * Optional header: x-api-key (must match INGEST_API_KEY if set)
 */
export type { IngestArticle };

export async function POST(request: NextRequest) {
  const ingestKey = process.env.INGEST_API_KEY;
  if (ingestKey) {
    const key = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (key !== ingestKey) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const { articles: raw } = body as { articles?: IngestArticle[] };

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Body must include an 'articles' array with at least one item." },
        { status: 400 }
      );
    }

    const result = await ingestArticles(raw);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[ingest]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingestion failed." },
      { status: 500 }
    );
  }
}
