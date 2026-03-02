/**
 * GET /api/cron/run-pipeline-part1
 * Daily cron: runs pipeline part 1 (event_features → daily_topic_metrics → derived_signals → oil + pharma signals).
 * Schedule after ingest (e.g. 10:00 UTC). Part 2 runs separately (run-pipeline-part2) after this.
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipelinePart1 } from "@/lib/pipeline/run";

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
    const results = await runPipelinePart1();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[run-pipeline-part1]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline part 1 failed" },
      { status: 500 }
    );
  }
}
