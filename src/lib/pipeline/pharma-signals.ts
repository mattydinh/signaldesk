/**
 * Pharma sector signals: PharmaPriceMomentum (XLV 30d return → 60d z),
 * 3-component composite (momentum + HealthcareSentiment + HealthcareVolume).
 * Writes PharmaPriceMomentum and PharmaCompositeSignal to derived_signals.
 */
import { prisma } from "@/lib/db";

const ROLLING_DAYS = 60;
const Z_CLIP = 3;
const MOMENTUM_DAYS = 30;
const XLV_TICKER = "XLV";

function zscoreClip(val: number): number {
  return Math.max(-Z_CLIP, Math.min(Z_CLIP, val));
}

async function runPharmaPriceMomentum(daysBack: number): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack - MOMENTUM_DAYS);

  const prices = await prisma.marketPrice.findMany({
    where: { ticker: XLV_TICKER, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  if (prices.length === 0) return 0;

  const dateToClose = new Map(prices.map((p) => [p.date.toISOString().slice(0, 10), p.close]));
  const dateStrs = Array.from(new Set(prices.map((p) => p.date.toISOString().slice(0, 10)))).sort();

  const momentumByDate: { dateStr: string; return30d: number }[] = [];
  for (const dateStr of dateStrs) {
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
      where: { date_signalName: { date, signalName: "PharmaPriceMomentum" } },
      create: {
        date,
        signalName: "PharmaPriceMomentum",
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

async function runPharmaComposite(daysBack: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [momentum, sentiment, volume] = await Promise.all([
    prisma.derivedSignal.findMany({
      where: { signalName: "PharmaPriceMomentum", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.derivedSignal.findMany({
      where: { signalName: "HealthcareSentiment", date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.derivedSignal.findMany({
      where: { signalName: "HealthcareVolume", date: { gte: since } },
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
    const raw = 0.4 * m + 0.35 * s + 0.25 * v;
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
      where: { date_signalName: { date, signalName: "PharmaCompositeSignal" } },
      create: {
        date,
        signalName: "PharmaCompositeSignal",
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

export async function runPharmaSignals(daysBack = 90): Promise<{
  pharmaPriceMomentum: number;
  pharmaComposite: number;
}> {
  const pharmaPriceMomentum = await runPharmaPriceMomentum(daysBack);
  const pharmaComposite = await runPharmaComposite(daysBack);
  return { pharmaPriceMomentum, pharmaComposite };
}
