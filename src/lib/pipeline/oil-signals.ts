/**
 * Oil & Gas signals (Phase 1): OilPriceMomentum from price 30d return,
 * 3-component composite (momentum + EnergySentiment + OilNewsVolume).
 * Writes OilPriceMomentum and OilCompositeSignal to derived_signals.
 * No EIA/rig in this phase.
 */
import { prisma } from "@/lib/db";

const ROLLING_DAYS = 60;
const Z_CLIP = 3;
const MOMENTUM_DAYS = 30;
/** WTI proxy: prefer CL=F, fallback USO if no data. */
const WTI_TICKERS = ["CL=F", "USO"] as const;

function zscoreClip(val: number): number {
  return Math.max(-Z_CLIP, Math.min(Z_CLIP, val));
}

/**
 * Compute 30d return series for a ticker, then rolling 60d z-score; write OilPriceMomentum.
 */
async function runOilPriceMomentum(daysBack: number): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack - MOMENTUM_DAYS);

  const ticker = await resolveWtiTicker(start, end);
  const prices = await prisma.marketPrice.findMany({
    where: { ticker, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  const dateToClose = new Map(prices.map((p) => [p.date.toISOString().slice(0, 10), p.close]));
  const dateStrs = prices.map((p) => p.date.toISOString().slice(0, 10));
  const uniqDates = Array.from(new Set(dateStrs)).sort();

  const momentumByDate: { dateStr: string; return30d: number }[] = [];
  for (const dateStr of uniqDates) {
    const d = new Date(dateStr + "Z");
    const d30 = new Date(d);
    d30.setUTCDate(d30.getUTCDate() - MOMENTUM_DAYS);
    const date30Str = d30.toISOString().slice(0, 10);
    const close = dateToClose.get(dateStr);
    const close30 = dateToClose.get(date30Str);
    if (close != null && close30 != null && close30 > 0) {
      momentumByDate.push({ dateStr, return30d: (close / close30 - 1) * 100 });
    }
  }

  let rowsWritten = 0;
  for (let i = 0; i < momentumByDate.length; i++) {
    const window = momentumByDate.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
    const values = window.map((w) => w.return30d);
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const variance =
      values.length > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1) : 0;
    const std = Math.sqrt(Math.max(0, variance)) || 1;
    const zscore = zscoreClip((momentumByDate[i].return30d - mean) / std);
    const date = new Date(momentumByDate[i].dateStr + "Z");

    await prisma.derivedSignal.upsert({
      where: { date_signalName: { date, signalName: "OilPriceMomentum" } },
      create: {
        date,
        signalName: "OilPriceMomentum",
        value: momentumByDate[i].return30d,
        zscore,
        confidence: 1,
      },
      update: { value: momentumByDate[i].return30d, zscore, confidence: 1 },
    });
    rowsWritten++;
  }
  return rowsWritten;
}

async function resolveWtiTicker(start: Date, end: Date): Promise<string> {
  for (const t of WTI_TICKERS) {
    const count = await prisma.marketPrice.count({
      where: { ticker: t, date: { gte: start, lte: end } },
    });
    if (count > 0) return t;
  }
  return WTI_TICKERS[WTI_TICKERS.length - 1];
}

/**
 * Read EnergySentiment and OilNewsVolume z-scores, compute weighted composite,
 * re-z-score over 60d and clip; write OilCompositeSignal.
 */
async function runOilComposite(daysBack: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [momentum, sentiment, volume] = await Promise.all([
    prisma.derivedSignal.findMany({
      where: { signalName: "OilPriceMomentum", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.derivedSignal.findMany({
      where: { signalName: "EnergySentiment", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.derivedSignal.findMany({
      where: { signalName: "OilNewsVolume", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
  ]);

  const momentumByDate = new Map(momentum.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const sentimentByDate = new Map(sentiment.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const volumeByDate = new Map(volume.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));

  const allDates = Array.from(
    new Set([
      ...Array.from(momentumByDate.keys()),
      ...Array.from(sentimentByDate.keys()),
      ...Array.from(volumeByDate.keys()),
    ])
  ).sort();

  const rawComposite: { dateStr: string; raw: number }[] = [];
  for (const dateStr of allDates) {
    const m = momentumByDate.get(dateStr) ?? 0;
    const s = sentimentByDate.get(dateStr) ?? 0;
    const v = volumeByDate.get(dateStr) ?? 0;
    const raw = 0.35 * m + 0.25 * s + 0.15 * v;
    rawComposite.push({ dateStr, raw });
  }

  let rowsWritten = 0;
  for (let i = 0; i < rawComposite.length; i++) {
    const window = rawComposite.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
    const values = window.map((w) => w.raw);
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const variance =
      values.length > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1) : 0;
    const std = Math.sqrt(Math.max(0, variance)) || 1;
    const zscore = zscoreClip((rawComposite[i].raw - mean) / std);
    const date = new Date(rawComposite[i].dateStr + "Z");

    await prisma.derivedSignal.upsert({
      where: { date_signalName: { date, signalName: "OilCompositeSignal" } },
      create: {
        date,
        signalName: "OilCompositeSignal",
        value: rawComposite[i].raw,
        zscore,
        confidence: 1,
      },
      update: { value: rawComposite[i].raw, zscore, confidence: 1 },
    });
    rowsWritten++;
  }
  return rowsWritten;
}

export async function runOilSignals(daysBack = 90): Promise<{ oilPriceMomentum: number; oilComposite: number }> {
  const oilPriceMomentum = await runOilPriceMomentum(daysBack);
  const oilComposite = await runOilComposite(daysBack);
  return { oilPriceMomentum, oilComposite };
}
