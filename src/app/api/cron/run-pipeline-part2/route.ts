/**
 * GET /api/cron/run-pipeline-part2
 * Daily cron: runs pipeline part 2 (market_prices → regime → backtests).
 * Schedule after part 1 (e.g. 11:00 UTC).
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipelinePart2 } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function auth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  return (header ?? query) === secret;
}

export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runPipelinePart2();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[run-pipeline-part2]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline part 2 failed" },
      { status: 500 }
    );
  }
}
