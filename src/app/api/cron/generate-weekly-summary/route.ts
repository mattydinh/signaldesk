import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWeeklySummary } from "@/lib/weeklySummary";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/generate-weekly-summary
 * Generates one WeeklySummary for the week that just ended (Sunday–Sunday UTC).
 * Schedule: Sundays 18:00 UTC. CRON_SECRET required if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceSunday = day === 0 ? 7 : day;
  const lastSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceSunday, 0, 0, 0, 0));

  const existing = await prisma.weeklySummary.findUnique({
    where: { weekStart: lastSunday },
  });
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "already exists", id: existing.id });
  }

  const result = await generateWeeklySummary(lastSunday);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
