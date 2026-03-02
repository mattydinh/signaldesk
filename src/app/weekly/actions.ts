"use server";

import { prisma } from "@/lib/db";
import { generateWeeklySummary } from "@/lib/weeklySummary";

/**
 * Generate the weekly brief for the week that just ended (same week as cron).
 * Call from the Weekly page to create the brief if the cron didn't run or failed.
 */
export async function generateWeeklyBriefAction(): Promise<{
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}> {
  try {
    const now = new Date();
    const day = now.getUTCDay();
    const daysSinceSunday = day === 0 ? 7 : day;
    const lastSunday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceSunday, 0, 0, 0, 0)
    );

    const existing = await prisma.weeklySummary.findUnique({
      where: { weekStart: lastSunday },
    });
    if (existing) {
      return { ok: true, skipped: true, id: existing.id };
    }

    const result = await generateWeeklySummary(lastSunday);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }
    return { ok: true, id: result.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate brief";
    console.error("[weekly] generateWeeklyBriefAction", e);
    return { ok: false, error: message };
  }
}
