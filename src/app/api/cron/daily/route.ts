import { NextRequest, NextResponse } from "next/server";
import { runPipelinePart1 } from "@/lib/pipeline/run";
import { fetchAndIngestNews } from "@/lib/fetch-news";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
 * GET /api/cron/daily
 * Runs once per day via Vercel cron:
 * - News ingest (RSS feeds → Supabase)
 * - Pipeline part 1 (events → features → signals; keeps Intelligence fresh)
 * - Prune old articles (storage/retention)
 */
export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = request.nextUrl.origin;
  const startedAt = new Date().toISOString();

  const out: Record<string, unknown> = { ok: true, startedAt };

  try {
    out.ingest = await fetchAndIngestNews();
  } catch (e) {
    console.error("[cron/daily] ingest failed", e);
    out.ingestError = e instanceof Error ? e.message : String(e);
  }

  try {
    out.pipelinePart1 = await runPipelinePart1();
  } catch (e) {
    console.error("[cron/daily] pipeline part1 failed", e);
    out.ok = false;
    out.pipelinePart1Error = e instanceof Error ? e.message : String(e);
  }

  try {
    out.prune = await callInternalCron(origin, "/api/cron/prune-articles");
  } catch (e) {
    console.error("[cron/daily] prune failed", e);
    out.ok = false;
    out.pruneError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(out, { status: out.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}

