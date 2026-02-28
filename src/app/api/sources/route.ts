import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getSourcesSupabase } from "@/lib/data-supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/sources — list all sources (for dashboard filter)
 */
export async function GET() {
  try {
    if (hasSupabaseDb()) {
      const sources = await getSourcesSupabase();
      return NextResponse.json({ sources });
    }
    const sources = await prisma.source.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json({ sources });
  } catch (e) {
    console.error("[sources]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch sources." },
      { status: 500 }
    );
  }
}
