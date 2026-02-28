import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase, getSourcesSupabase } from "@/lib/data-supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/articles — list articles (paginated, full-text search, filter by source)
 * Query: page, limit, sourceId, q (PostgreSQL full-text search on title/summary, or ilike when using Supabase)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const sourceId = searchParams.get("sourceId") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const q = searchParams.get("q")?.trim() ?? undefined;
    const offset = (page - 1) * limit;

    if (hasSupabaseDb()) {
      const { articles, total } = await getArticlesSupabase({
        limit,
        offset,
        sourceId,
        category,
        q,
      });
      const sources = await getSourcesSupabase();
      const sourceMap = new Map(sources.map((s) => [s.id, s]));
      const articlesWithSource = articles.map((a) => ({
        ...a,
        source: { name: sourceMap.get(a.sourceId)?.name ?? "Unknown" },
      }));
      return NextResponse.json({
        articles: articlesWithSource,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    let articleIds: string[] | null = null;
    if (q) {
      const tokens = q.replace(/\s+/g, " ").trim().slice(0, 200);
      if (tokens.length > 0) {
        const rows = await prisma.$queryRaw<[{ id: string }]>`
        SELECT id FROM "Article"
        WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '')) @@ plainto_tsquery('english', ${tokens})
        ${sourceId ? Prisma.sql`AND "sourceId" = ${sourceId}` : Prisma.empty}
        ORDER BY "publishedAt" DESC NULLS LAST
      `;
        articleIds = rows.map((r) => r.id);
      }
    }

    type Where = {
      sourceId?: string;
      id?: { in: string[] };
      OR?: Array<{ title?: { contains: string; mode: "insensitive" }; summary?: { contains: string; mode: "insensitive" } }>;
    };
    const where: Where = {};
    let total = 0;
    let idsToFetch: string[] | null = null;

    if (articleIds !== null) {
      total = articleIds.length;
      if (total === 0) {
        return NextResponse.json({
          articles: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }
      idsToFetch = articleIds.slice(offset, offset + limit);
      where.id = { in: idsToFetch };
    } else {
      if (sourceId) where.sourceId = sourceId;
      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const [articles, countResult] = await Promise.all([
      prisma.article.findMany({
        where: idsToFetch ? { id: { in: idsToFetch } } : where,
        include: { source: true },
        orderBy: { publishedAt: "desc" },
        ...(idsToFetch ? {} : { skip: offset, take: limit }),
      }),
      articleIds !== null ? Promise.resolve(null) : prisma.article.count({ where }),
    ]);
    if (countResult !== null) total = countResult;

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
