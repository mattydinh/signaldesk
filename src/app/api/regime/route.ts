import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET /api/regime — latest regime snapshot */
export async function GET() {
  try {
    const latest = await prisma.regimeSnapshot.findFirst({
      orderBy: { date: "desc" },
    });
    if (!latest)
      return NextResponse.json({ regime: null });
    return NextResponse.json({
      regime: latest.regime,
      date: latest.date.toISOString().slice(0, 10),
      confidence: latest.confidence,
      drivers: latest.drivers,
    });
  } catch (e) {
    console.error("[api/regime]", e);
    return NextResponse.json({ error: "Failed to fetch regime" }, { status: 500 });
  }
}
