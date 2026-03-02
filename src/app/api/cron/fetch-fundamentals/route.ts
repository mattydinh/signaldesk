/**
 * GET /api/cron/fetch-fundamentals
 * Fetches EIA crude inventory (and optionally Baker Hughes rig count), persists to WeeklyFundamental.
 * Call weekly after EIA release (e.g. Wednesday) or before pipeline run.
 * Requires CRON_SECRET if set. EIA_API_KEY required for EIA; OILPRICE_API_KEY optional for rig.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchAndPersistAll } from "@/lib/pipeline/weekly-fundamentals";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function auth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  return (header ?? query) === secret;
}

export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { eia, rig } = await fetchAndPersistAll();
    return NextResponse.json({
      ok: true,
      eia: { rows: eia.rows, error: eia.error },
      rig: { rows: rig.rows, error: rig.error },
    });
  } catch (e) {
    console.error("[fetch-fundamentals]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
