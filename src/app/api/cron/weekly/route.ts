import { NextRequest, NextResponse } from "next/server";
import { runPipelinePart2 } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function auth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const raw =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("secret");
  return (raw ?? "").trim() === secret;
}

async function callInternalCron(origin: string, path: string): Promise<unknown> {
  const secret = process.env.CRON_SECRET?.trim();
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  const res = await fetch(`${origin}${path}`, { headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

/**
 * GET /api/cron/weekly
 * Scheduled daily, but only runs certain tasks on specific UTC weekdays:
 * - Wednesday (3): fetch fundamentals
 * - Sunday (0): run pipeline part 2 + generate weekly summary
 */
export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = request.nextUrl.origin;
  const day = new Date().getUTCDay(); // 0=Sun..6=Sat
  const startedAt = new Date().toISOString();

  const out: Record<string, unknown> = { ok: true, startedAt, utcDay: day };

  // Wednesday: fundamentals
  if (day === 3) {
    try {
      out.fundamentals = await callInternalCron(origin, "/api/cron/fetch-fundamentals");
    } catch (e) {
      console.error("[cron/weekly] fundamentals failed", e);
      out.ok = false;
      out.fundamentalsError = e instanceof Error ? e.message : String(e);
    }
  }

  // Sunday: pipeline part 2 + weekly summary
  if (day === 0) {
    try {
      out.pipelinePart2 = await runPipelinePart2();
    } catch (e) {
      console.error("[cron/weekly] pipeline part2 failed", e);
      out.ok = false;
      out.pipelinePart2Error = e instanceof Error ? e.message : String(e);
    }
    try {
      out.weeklySummary = await callInternalCron(origin, "/api/cron/generate-weekly-summary");
    } catch (e) {
      console.error("[cron/weekly] weekly summary failed", e);
      out.ok = false;
      out.weeklySummaryError = e instanceof Error ? e.message : String(e);
    }
  }

  if (day !== 0 && day !== 3) {
    out.skipped = "No weekly tasks scheduled for this UTC day.";
  }

  return NextResponse.json(out, { status: out.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}

