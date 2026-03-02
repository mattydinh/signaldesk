/**
 * GET /api/cron/run-pipeline
 * Runs the ML pipeline in order: event_features → daily_topic_metrics → derived_signals → market_prices → regime → backtest.
 * Secure with CRON_SECRET or Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";

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
    const results = await runPipeline();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[run-pipeline]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
