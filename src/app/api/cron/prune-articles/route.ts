import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin, hasSupabaseDb } from "@/lib/supabase-server";

const DEFAULT_RETENTION_DAYS = 30;

export const maxDuration = 60;

/**
 * GET /api/cron/prune-articles
 * Deletes articles older than ARTICLE_RETENTION_DAYS (default 30).
 * Reduces storage and keeps the feed to a rolling window. CRON_SECRET required if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const retentionDays =
    typeof process.env.ARTICLE_RETENTION_DAYS !== "undefined"
      ? parseInt(process.env.ARTICLE_RETENTION_DAYS, 10)
      : DEFAULT_RETENTION_DAYS;

  if (retentionDays <= 0 || Number.isNaN(retentionDays)) {
    return NextResponse.json({
      ok: true,
      message: "Prune skipped (ARTICLE_RETENTION_DAYS is 0 or invalid)",
      deleted: { supabase: 0, prisma: 0 },
    });
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const results = { supabase: 0, prisma: 0 };

  if (hasSupabaseDb()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const table = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";
      const sb = supabase as any;
      const { data, error } = await sb
        .from(table)
        .delete()
        .lt("publishedAt", cutoff.toISOString())
        .select("id");
      if (error) {
        console.error("[prune-articles] Supabase delete error", error);
        return NextResponse.json(
          { error: "Supabase delete failed", details: String(error) },
          { status: 500 }
        );
      }
      results.supabase = Array.isArray(data) ? data.length : 0;
    }
  }

  try {
    const prismaResult = await prisma.article.deleteMany({
      where: { publishedAt: { lt: cutoff } },
    });
    results.prisma = prismaResult.count;
  } catch (e) {
    console.error("[prune-articles] Prisma delete error", e);
    // When using Supabase-only, Prisma may be unconfigured or unreachable; still return success
  }

  return NextResponse.json({
    ok: true,
    message: `Pruned articles older than ${retentionDays} days`,
    cutoff: cutoff.toISOString(),
    deleted: results,
  });
}
