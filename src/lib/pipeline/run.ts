/**
 * Shared pipeline runner. Used by GET /api/cron/run-pipeline, after ingest, and when Intelligence has no data.
 */
import { runEventFeatures } from "@/lib/pipeline/event-features";
import { runDailyTopicMetrics } from "@/lib/pipeline/daily-topic-metrics";
import { runDerivedSignals } from "@/lib/pipeline/derived-signals";
import { runMarketPrices } from "@/lib/pipeline/market-prices";
import { runRegime } from "@/lib/pipeline/regime";
import { runBacktest } from "@/lib/pipeline/backtest";

export async function runPipeline(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

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

  return results;
}
