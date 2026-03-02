"use server";

import { prisma } from "@/lib/db";
import { generateWeeklySummary, getPastWeekStart } from "@/lib/weeklySummary";

/**
 * Generate the weekly brief for the week that just ended (past week only).
 * We never generate for the current week so the brief is always a full week's summary.
 */
export async function generateWeeklyBriefAction(): Promise<{
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}> {
  try {
    const now = new Date();
    const pastWeekStart = getPastWeekStart(now);

    const existing = await prisma.weeklySummary.findUnique({
      where: { weekStart: pastWeekStart },
    });
    if (existing) {
      return { ok: true, skipped: true, id: existing.id };
    }

    const result = await generateWeeklySummary(pastWeekStart);
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
