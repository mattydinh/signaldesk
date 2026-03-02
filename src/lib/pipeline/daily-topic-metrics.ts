/**
 * Pipeline step 2: aggregate events + event_features into daily_topic_metrics by topic (category) and date.
 * Topics = ARTICLE_CATEGORIES; events with empty categories are skipped for topic aggregation (or could infer via inferCategoriesFromText).
 */
import { prisma } from "@/lib/db";
import { ARTICLE_CATEGORIES } from "@/lib/categories";
import { inferCategoriesFromText } from "@/lib/categories";

const ROLLING_DAYS = 60;

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runDailyTopicMetrics(daysBack = 90): Promise<{ rowsUpserted: number }> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const events = await prisma.event.findMany({
    where: { publishedAt: { gte: since }, features: { isNot: null } },
    include: { features: true },
    orderBy: { publishedAt: "asc" },
  });

  const byTopicDate = new Map<
    string,
    { count: number; sentimentSum: number; sentimentSqSum: number }
  >();
  for (const e of events) {
    const categories =
      e.categories?.length > 0
        ? e.categories
        : inferCategoriesFromText(e.rawText, null).filter((c) => c !== "Other");
    if (categories.length === 0) continue;
    const dateStr = toDate(e.publishedAt);
    const sentiment = e.features?.sentimentScore ?? 0;
    for (const topic of categories) {
      if (!ARTICLE_CATEGORIES.includes(topic as any)) continue;
      const key = `${topic}\t${dateStr}`;
      const cur = byTopicDate.get(key) ?? {
        count: 0,
        sentimentSum: 0,
        sentimentSqSum: 0,
      };
      cur.count += 1;
      cur.sentimentSum += sentiment;
      cur.sentimentSqSum += sentiment * sentiment;
      byTopicDate.set(key, cur);
    }
  }

  const dateStrs = Array.from(
    new Set(Array.from(byTopicDate.keys()).map((k) => k.split("\t")[1]))
  ).sort();

  let rowsUpserted = 0;
  for (const [key, v] of Array.from(byTopicDate.entries())) {
    const [topic, dateStr] = key.split("\t");
    const date = new Date(dateStr + "Z");
    const n = v.count;
    const avgSentiment = n > 0 ? v.sentimentSum / n : 0;
    const variance =
      n > 1 ? (v.sentimentSqSum - (v.sentimentSum * v.sentimentSum) / n) / (n - 1) : 0;
    const sentimentStd = Math.sqrt(Math.max(0, variance));

    const idx = dateStrs.indexOf(dateStr);
    const sevenDaysAgo = new Date(date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenStr = toDate(sevenDaysAgo);
    const prevKey = `${topic}\t${sevenStr}`;
    const prev = byTopicDate.get(prevKey);
    const prevAvg = prev && prev.count > 0 ? prev.sentimentSum / prev.count : 0;
    const sentimentChange7d = avgSentiment - prevAvg;

    const vol = v.count;
    const startIdx = Math.max(0, idx - ROLLING_DAYS);
    const windowDates = dateStrs.slice(startIdx, idx + 1);
    const topicVolumes = windowDates.map(
      (d) => byTopicDate.get(`${topic}\t${d}`)?.count ?? 0
    );
    const mean = topicVolumes.reduce((a, b) => a + b, 0) / topicVolumes.length || 1;
    const varianceVol =
      topicVolumes.length > 1
        ? topicVolumes.reduce((s, x) => s + (x - mean) ** 2, 0) / (topicVolumes.length - 1)
        : 0;
    const std = Math.sqrt(Math.max(0, varianceVol)) || 1;
    const volumeZscore = (vol - mean) / std;

    await prisma.dailyTopicMetric.upsert({
      where: {
        topic_date: { topic, date },
      },
      create: {
        topic,
        date,
        articleCount: n,
        avgSentiment,
        sentimentStd,
        sentimentChange7d,
        volumeZscore,
      },
      update: {
        articleCount: n,
        avgSentiment,
        sentimentStd,
        sentimentChange7d,
        volumeZscore,
      },
    });
    rowsUpserted++;
  }
  return { rowsUpserted };
}
