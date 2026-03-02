/**
 * GET /api/cron/run-pipeline
 * Runs the ML pipeline in order: event_features → daily_topic_metrics → derived_signals → market_prices → regime → backtest.
 * Secure with CRON_SECRET or Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { runEventFeatures } from "@/lib/pipeline/event-features";
import { runDailyTopicMetrics } from "@/lib/pipeline/daily-topic-metrics";
import { runDerivedSignals } from "@/lib/pipeline/derived-signals";
import { runMarketPrices } from "@/lib/pipeline/market-prices";
import { runRegime } from "@/lib/pipeline/regime";
import { runBacktest } from "@/lib/pipeline/backtest";

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

  const results: Record<string, unknown> = {};

  try {
    const r1 = await runEventFeatures(200);
    results.event_features = r1;

    const r2 = await runDailyTopicMetrics(90);
    results.daily_topic_metrics = r2;

    const r3 = await runDerivedSignals(90);
    results.derived_signals = r3;

    const r4 = await runMarketPrices(365);
    results.market_prices = r4;

    const r5 = await runRegime();
    results.regime = r5;

    const signals = ["GeopoliticsVolume", "RegulationVolume", "MarketsSentiment"];
    for (const sig of signals) {
      await runBacktest(sig, "SPY").catch((e) => {
        console.error("[run-pipeline] backtest", sig, e);
      });
    }
    results.backtest = "ok";
  } catch (e) {
    console.error("[run-pipeline]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pipeline failed", results },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, results });
}
