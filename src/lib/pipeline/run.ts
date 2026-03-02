/**
 * Shared pipeline runner. Used by GET /api/cron/run-pipeline, after ingest, and when Intelligence has no data.
 * Use ?part=1 and ?part=2 to run in two steps and avoid Vercel FUNCTION_INVOCATION_TIMEOUT (60s).
 */
import { runEventFeatures } from "@/lib/pipeline/event-features";
import { runDailyTopicMetrics } from "@/lib/pipeline/daily-topic-metrics";
import { runDerivedSignals } from "@/lib/pipeline/derived-signals";
import { runOilSignals } from "@/lib/pipeline/oil-signals";
import { runMarketPrices } from "@/lib/pipeline/market-prices";
import { runRegime } from "@/lib/pipeline/regime";
import { runBacktest } from "@/lib/pipeline/backtest";

/** Part 1: events → features → topic metrics → derived signals → oil signals (often ~30–50s). */
export async function runPipelinePart1(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  results.event_features = await runEventFeatures(200);
  results.daily_topic_metrics = await runDailyTopicMetrics(90);
  results.derived_signals = await runDerivedSignals(90);
  results.oil_signals = await runOilSignals(90);
  return results;
}

/** Part 2: market prices → regime → backtest (often ~30–50s). */
export async function runPipelinePart2(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  results.market_prices = await runMarketPrices(365);
  results.regime = await runRegime();
  const signals = ["GeopoliticsVolume", "RegulationVolume", "MarketsSentiment"];
  for (const sig of signals) {
    await runBacktest(sig, "SPY").catch((e) => console.error("[run-pipeline] backtest", sig, e));
  }
  const oilTickers = ["USO", "XLE", "SPY"];
  for (const ticker of oilTickers) {
    await runBacktest("OilCompositeSignal", ticker).catch((e) =>
      console.error("[run-pipeline] backtest OilCompositeSignal", ticker, e)
    );
  }
  results.backtest = "ok";
  return results;
}

export async function runPipeline(): Promise<Record<string, unknown>> {
  const part1 = await runPipelinePart1();
  const part2 = await runPipelinePart2();
  return { ...part1, ...part2 };
}
