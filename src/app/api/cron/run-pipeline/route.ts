/**
 * GET /api/cron/run-pipeline
 * Runs the ML pipeline. On Vercel (60s limit) use ?part=1 then ?part=2 to avoid FUNCTION_INVOCATION_TIMEOUT.
 * - part=1: event_features → daily_topic_metrics → derived_signals
 * - part=2: market_prices → regime → backtest
 * - no part: full pipeline (may timeout with many events).
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline, runPipelinePart1, runPipelinePart2 } from "@/lib/pipeline/run";

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

  const part = request.nextUrl.searchParams.get("part");

  try {
    const results =
      part === "1"
        ? await runPipelinePart1()
        : part === "2"
          ? await runPipelinePart2()
          : await runPipeline();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[run-pipeline]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
