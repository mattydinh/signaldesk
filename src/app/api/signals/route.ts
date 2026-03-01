import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/signals
 * Returns derived signals. Query params: signal_name, start_date, end_date (YYYY-MM-DD), limit.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const signalName = searchParams.get("signal_name") ?? undefined;
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = Math.min(Number(searchParams.get("limit")) || 500, 1000);

    const where: { signalName?: string; date?: { gte?: Date; lte?: Date } } = {};
    if (signalName) where.signalName = signalName;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const signals = await prisma.derivedSignal.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { date: "asc" },
      take: limit,
    });

    return NextResponse.json({
      signals: signals.map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        signal_name: s.signalName,
        value: s.value,
        zscore: s.zscore,
        confidence: s.confidence,
      })),
    });
  } catch (e) {
    console.error("[api/signals]", e);
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
