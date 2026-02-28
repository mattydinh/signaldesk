import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * News Ingestion API
 * POST /api/news/ingest — accept articles and store them
 * Body: { articles: IngestArticle[] }
 */

export type IngestArticle = {
  externalId?: string;
  sourceName: string;
  sourceSlug?: string;
  sourceBaseUrl?: string;
  title: string;
  summary?: string;
  url?: string;
  publishedAt?: string; // ISO date
  rawPayload?: unknown;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articles: raw } = body as { articles?: IngestArticle[] };

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Body must include an 'articles' array with at least one item." },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const a of raw) {
      if (!a.title || !a.sourceName) {
        skipped++;
        continue;
      }

      const slug = a.sourceSlug ?? slugify(a.sourceName);

      const source = await prisma.source.upsert({
        where: { slug },
        create: {
          name: a.sourceName,
          slug,
          baseUrl: a.sourceBaseUrl ?? null,
        },
        update: {},
      });

      const publishedAt = a.publishedAt ? new Date(a.publishedAt) : null;

      const existing = a.externalId
        ? await prisma.article.findFirst({
            where: { sourceId: source.id, externalId: a.externalId },
          })
        : null;

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.article.create({
        data: {
          sourceId: source.id,
          externalId: a.externalId ?? null,
          title: a.title,
          summary: a.summary ?? null,
          url: a.url ?? null,
          publishedAt,
          rawPayload: a.rawPayload ? (a.rawPayload as object) : null,
        },
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      total: raw.length,
    });
  } catch (e) {
    console.error("[ingest]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingestion failed." },
      { status: 500 }
    );
  }
}
