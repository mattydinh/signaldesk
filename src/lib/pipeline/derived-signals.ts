/**
 * Pipeline step 3: build derived_signals from daily_topic_metrics.
 * Rolling 60-day z-score; clip ±3; confidence from article count vs rolling avg.
 */
import { prisma } from "@/lib/db";

const ROLLING_DAYS = 60;
const Z_CLIP = 3;

const SIGNAL_DEFS: { name: string; topic: string; useVolume: boolean; useSentiment: boolean }[] = [
  { name: "GeopoliticsVolume", topic: "Geopolitics", useVolume: true, useSentiment: false },
  { name: "RegulationVolume", topic: "Regulation", useVolume: true, useSentiment: false },
  { name: "MarketsSentiment", topic: "Markets", useVolume: false, useSentiment: true },
  { name: "FinanceSentiment", topic: "Finance", useVolume: false, useSentiment: true },
  { name: "TechnologyVolume", topic: "Technology", useVolume: true, useSentiment: false },
  { name: "WarConflictVolume", topic: "War & Conflict", useVolume: true, useSentiment: false },
  { name: "EnergySentiment", topic: "Energy", useVolume: false, useSentiment: true },
  { name: "OilNewsVolume", topic: "Energy", useVolume: true, useSentiment: false },
];

function zscoreClip(val: number): number {
  return Math.max(-Z_CLIP, Math.min(Z_CLIP, val));
}

export async function runDerivedSignals(daysBack = 90): Promise<{ rowsWritten: number }> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const metrics = await prisma.dailyTopicMetric.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const byTopicDate = new Map<string, { count: number; avgSentiment: number; volumeZscore: number }>();
  for (const m of metrics) {
    const key = `${m.topic}\t${m.date.toISOString().slice(0, 10)}`;
    byTopicDate.set(key, {
      count: m.articleCount,
      avgSentiment: m.avgSentiment,
      volumeZscore: m.volumeZscore,
    });
  }

  const dateStrs = Array.from(
    new Set(metrics.map((m) => m.date.toISOString().slice(0, 10)))
  ).sort();
  let rowsWritten = 0;

  for (const def of SIGNAL_DEFS) {
    const values: { dateStr: string; value: number; count: number }[] = [];
    for (const dateStr of dateStrs) {
      const key = `${def.topic}\t${dateStr}`;
      const row = byTopicDate.get(key);
      if (!row) continue;
      let value = 0;
      if (def.useVolume) value += row.volumeZscore;
      if (def.useSentiment) value += row.avgSentiment;
      values.push({ dateStr, value, count: row.count });
    }

    for (let i = 0; i < values.length; i++) {
      const window = values.slice(Math.max(0, i - ROLLING_DAYS + 1), i + 1);
      const mean = window.reduce((s, x) => s + x.value, 0) / window.length || 0;
      const variance =
        window.length > 1
          ? window.reduce((s, x) => s + (x.value - mean) ** 2, 0) / (window.length - 1)
          : 0;
      const std = Math.sqrt(Math.max(0, variance)) || 1;
      const zscore = zscoreClip((values[i].value - mean) / std);
      const avgCount = window.reduce((s, x) => s + x.count, 0) / window.length || 1;
      const confidence = Math.min(1, values[i].count / avgCount);
      const date = new Date(values[i].dateStr + "Z");

      await prisma.derivedSignal.upsert({
        where: { date_signalName: { date, signalName: def.name } },
        create: {
          date,
          signalName: def.name,
          value: values[i].value,
          zscore,
          confidence,
        },
        update: { value: values[i].value, zscore, confidence },
      });
      rowsWritten++;
    }
  }

  return { rowsWritten };
}
