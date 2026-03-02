/**
 * Pipeline step 1: compute event_features for events that don't have them.
 * Uses keyword-based sentiment and theme scores (no external API).
 */
import { prisma } from "@/lib/db";

const NEGATIVE =
  /fall|decline|drop|loss|recession|inflation|risk|tariff|sanction|war|conflict|cut|layoff|miss|weak|slow|concern|fear|volatility|crash/i;
const POSITIVE =
  /gain|growth|rise|surge|beat|record|deal|partnership|approval|recovery|strong|bull|rally|expansion|profit|revenue/i;
const REGULATION =
  /regulation|regulatory|sec|fed\b|compliance|law\b|legislation|antitrust|doj|ftc|ruling|court|policy|oversight/i;
const GEOPOLITICAL =
  /china|russia|sanction|tariff|nato|military|defense|geopolitic|trade war|tension|election|biden|trump|congress/i;

function simpleSentiment(text: string): { score: number; confidence: number } {
  const t = text.slice(0, 4000);
  const pos = (t.match(new RegExp(POSITIVE.source, "gi")) ?? []).length;
  const neg = (t.match(new RegExp(NEGATIVE.source, "gi")) ?? []).length;
  const total = pos + neg || 1;
  const score = (pos - neg) / total;
  const confidence = Math.min(1, t.length / 500);
  return { score: Math.max(-1, Math.min(1, score)), confidence };
}

function themeScore(text: string, regex: RegExp): number {
  const t = text.slice(0, 4000);
  const matches = t.match(new RegExp(regex.source, "gi"));
  const count = matches?.length ?? 0;
  return Math.min(1, count / 5);
}

export async function runEventFeatures(batchSize = 100): Promise<{ processed: number }> {
  const events = await prisma.event.findMany({
    where: { features: null },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });
  let processed = 0;
  for (const e of events) {
    const text = (e.cleanText ?? e.rawText) || "";
    const { score: sentimentScore, confidence: sentimentConfidence } = simpleSentiment(text);
    const regulationScore = themeScore(text, REGULATION);
    const geopoliticalRiskScore = themeScore(text, GEOPOLITICAL);
    await prisma.eventFeature.upsert({
      where: { eventId: e.id },
      create: {
        eventId: e.id,
        sentimentScore,
        sentimentConfidence,
        regulationScore,
        geopoliticalRiskScore,
      },
      update: {},
    });
    processed++;
  }
  return { processed };
}
