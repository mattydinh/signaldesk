/**
 * Oil & Gas signals: OilPriceMomentum, EnergySentiment, OilNewsVolume (Phase 1);
 * InventoryShock (EIA), RigTrend (Baker Hughes) and 5-component composite (Phase 2).
 */
import { prisma } from "@/lib/db";
import {
  getDailyForwardFilled,
  EIA_CRUDE_SERIES,
  BAKER_HUGHES_RIG_SERIES,
} from "@/lib/pipeline/weekly-fundamentals";

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

const RIG_4W_DAYS = 28;

/**
 * EIA inventory week-over-week change, forward-filled to daily; rolling 60d z-score → InventoryShock.
 */
async function runInventoryShock(daysBack: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const end = new Date();
  const dateStrs: string[] = [];
  for (let d = new Date(since); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dateStrs.push(d.toISOString().slice(0, 10));
  }
  const dailyValues = await getDailyForwardFilled(EIA_CRUDE_SERIES, dateStrs);
  if (dailyValues.size === 0) return 0;

  const sortedDates = Array.from(dailyValues.keys()).sort();
  const values = sortedDates.map((d) => dailyValues.get(d)!);
  let rowsWritten = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    const window = values.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
    const mean = window.reduce((s, x) => s + x, 0) / window.length;
    const variance =
      window.length > 1 ? window.reduce((s, x) => s + (x - mean) ** 2, 0) / (window.length - 1) : 0;
    const std = Math.sqrt(Math.max(0, variance)) || 1;
    const zscore = zscoreClip((values[i] - mean) / std);
    const date = new Date(sortedDates[i] + "Z");
    await prisma.derivedSignal.upsert({
      where: { date_signalName: { date, signalName: "InventoryShock" } },
      create: { date, signalName: "InventoryShock", value: values[i], zscore, confidence: 1 },
      update: { value: values[i], zscore, confidence: 1 },
    });
    rowsWritten++;
  }
  return rowsWritten;
}

/**
 * Baker Hughes rig count forward-filled to daily; 4w change, rolling 60d z-score → RigTrend.
 */
async function runRigTrend(daysBack: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack - RIG_4W_DAYS);
  const end = new Date();
  const dateStrs: string[] = [];
  for (let d = new Date(since); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dateStrs.push(d.toISOString().slice(0, 10));
  }
  const dailyRig = await getDailyForwardFilled(BAKER_HUGHES_RIG_SERIES, dateStrs);
  if (dailyRig.size === 0) return 0;

  const sortedDates = Array.from(dailyRig.keys()).sort();
  const change4w: { dateStr: string; change: number }[] = [];
  for (let i = 0; i < sortedDates.length; i++) {
    const d = new Date(sortedDates[i] + "Z");
    const d4 = new Date(d);
    d4.setUTCDate(d4.getUTCDate() - RIG_4W_DAYS);
    const d4Str = d4.toISOString().slice(0, 10);
    const curr = dailyRig.get(sortedDates[i]);
    const prev = dailyRig.get(d4Str);
    if (curr != null && prev != null) change4w.push({ dateStr: sortedDates[i], change: curr - prev });
  }
  if (change4w.length === 0) return 0;

  const dateStrOrder = change4w.map((c) => c.dateStr);
  const changes = change4w.map((c) => c.change);
  let rowsWritten = 0;
  for (let i = 0; i < change4w.length; i++) {
    const window = changes.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
    const mean = window.reduce((s, x) => s + x, 0) / window.length;
    const variance =
      window.length > 1 ? window.reduce((s, x) => s + (x - mean) ** 2, 0) / (window.length - 1) : 0;
    const std = Math.sqrt(Math.max(0, variance)) || 1;
    const zscore = zscoreClip((changes[i] - mean) / std);
    const date = new Date(dateStrOrder[i] + "Z");
    await prisma.derivedSignal.upsert({
      where: { date_signalName: { date, signalName: "RigTrend" } },
      create: { date, signalName: "RigTrend", value: changes[i], zscore, confidence: 1 },
      update: { value: changes[i], zscore, confidence: 1 },
    });
    rowsWritten++;
  }
  return rowsWritten;
}

/**
 * Read all five components (momentum, sentiment, volume, inventory, rig), compute weighted composite,
 * re-z-score over 60d and clip; write OilCompositeSignal.
 */
async function runOilComposite(daysBack: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [momentum, sentiment, volume, inventory, rig] = await Promise.all([
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
    prisma.derivedSignal.findMany({
      where: { signalName: "InventoryShock", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.derivedSignal.findMany({
      where: { signalName: "RigTrend", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
  ]);

  const momentumByDate = new Map(momentum.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const sentimentByDate = new Map(sentiment.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const volumeByDate = new Map(volume.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const inventoryByDate = new Map(inventory.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));
  const rigByDate = new Map(rig.map((s) => [s.date.toISOString().slice(0, 10), s.zscore]));

  const allDates = Array.from(
    new Set([
      ...Array.from(momentumByDate.keys()),
      ...Array.from(sentimentByDate.keys()),
      ...Array.from(volumeByDate.keys()),
      ...Array.from(inventoryByDate.keys()),
      ...Array.from(rigByDate.keys()),
    ])
  ).sort();

  const rawComposite: { dateStr: string; raw: number }[] = [];
  for (const dateStr of allDates) {
    const m = momentumByDate.get(dateStr) ?? 0;
    const s = sentimentByDate.get(dateStr) ?? 0;
    const v = volumeByDate.get(dateStr) ?? 0;
    const inv = inventoryByDate.get(dateStr) ?? 0;
    const r = rigByDate.get(dateStr) ?? 0;
    const raw = 0.35 * m + 0.25 * s + 0.15 * v + 0.15 * inv + 0.1 * r;
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

export async function runOilSignals(daysBack = 90): Promise<{
  oilPriceMomentum: number;
  inventoryShock: number;
  rigTrend: number;
  oilComposite: number;
}> {
  const oilPriceMomentum = await runOilPriceMomentum(daysBack);
  const inventoryShock = await runInventoryShock(daysBack);
  const rigTrend = await runRigTrend(daysBack);
  const oilComposite = await runOilComposite(daysBack);
  return { oilPriceMomentum, inventoryShock, rigTrend, oilComposite };
}
