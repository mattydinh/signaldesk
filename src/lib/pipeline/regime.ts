/**
 * Pipeline step 5: rule-based regime classification from derived_signals.
 */
import { prisma } from "@/lib/db";

export async function runRegime(): Promise<{ date: Date; regime: string } | null> {
  const latest = await prisma.derivedSignal.findFirst({
    orderBy: { date: "desc" },
  });
  if (!latest) return null;

  const date = latest.date;
  const signals = await prisma.derivedSignal.findMany({
    where: { date },
  });
  const byName = new Map(signals.map((s) => [s.signalName, s]));

  const geopoliticsZ = byName.get("GeopoliticsVolume")?.zscore ?? 0;
  const regulationZ = byName.get("RegulationVolume")?.zscore ?? 0;
  const marketsZ = byName.get("MarketsSentiment")?.zscore ?? 0;
  const financeZ = byName.get("FinanceSentiment")?.zscore ?? 0;
  const aggregateSentimentZ = (marketsZ + financeZ) / 2;

  let regime: string;
  if (geopoliticsZ > 1.5) regime = "Escalation";
  else if (regulationZ > 1.5) regime = "Regulatory Pressure";
  else if (aggregateSentimentZ < -1) regime = "Risk-Off";
  else regime = "Risk-On";

  const sorted = [...signals].sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
  const top3 = sorted.slice(0, 3).map((s) => s.signalName);
  const confidence = Math.min(1, Math.abs(sorted[0]?.zscore ?? 0) / 3);

  await prisma.regimeSnapshot.upsert({
    where: { date },
    create: { date, regime, confidence, drivers: top3 },
    update: { regime, confidence, drivers: top3 },
  });

  return { date, regime };
}
