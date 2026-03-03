import { NextRequest, NextResponse } from "next/server";
import { analyzeArticle } from "@/lib/analyze";

/**
 * POST /api/articles/[id]/analyze
 * Thin wrapper around analyzeArticle() from src/lib/analyze.ts.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await analyzeArticle(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
