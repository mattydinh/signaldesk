import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWeeklySummary, getPastWeekStart } from "@/lib/weeklySummary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/generate-weekly-summary
 * Generates one WeeklySummary for the week that just ended (Sunday–Sunday UTC).
 * Schedule: Sundays 18:00 UTC. CRON_SECRET required if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const raw =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    const provided = (raw ?? "").trim();
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const pastWeekStart = getPastWeekStart(now);

  const existing = await prisma.weeklySummary.findUnique({
    where: { weekStart: pastWeekStart },
  });
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "already exists", id: existing.id });
  }

  const result = await generateWeeklySummary(pastWeekStart);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
