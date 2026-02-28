import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/articles — list articles (paginated, full-text search, filter by source)
 * Query: page, limit, sourceId, q (search in title/summary)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const sourceId = searchParams.get("sourceId") ?? undefined;
    const q = searchParams.get("q")?.trim();
    const offset = (page - 1) * limit;

    type Where = {
      sourceId?: string;
      OR?: Array<{ title?: { contains: string; mode: "insensitive" }; summary?: { contains: string; mode: "insensitive" } }>;
    };
    const where: Where = {};
    if (sourceId) where.sourceId = sourceId;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: { source: true },
        orderBy: { publishedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    return NextResponse.json({
      articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[articles]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch articles." },
      { status: 500 }
    );
  }
}
