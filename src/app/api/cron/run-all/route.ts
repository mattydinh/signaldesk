import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestNews } from "@/lib/fetch-news";
import { analyzeArticle, getAnalyzeConfig } from "@/lib/analyze";
import { getUnanalyzedArticles } from "@/lib/data-supabase";
import { runPipelinePart1, runPipelinePart2 } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ANALYZE_BATCH_SIZE = 10;
const ANALYZE_DELAY_MS = 4000; // 4s between Groq calls — safe for 6k TPM free tier

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("secret");
  return (provided ?? "").trim() === secret;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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

type StepResult = Record<string, unknown>;

async function runStep(
  out: StepResult,
  key: string,
  fn: () => Promise<unknown>,
  critical = false,
): Promise<void> {
  try {
    out[key] = await fn();
  } catch (e) {
    console.error(`[cron/run-all] ${key} failed`, e);
    out[`${key}Error`] = errorMessage(e);
    if (critical) out.ok = false;
  }
}

async function analyzeUnanalyzedArticles(): Promise<{ queued: number; analyzed: number; failed: number }> {
  const unanalyzed = await getUnanalyzedArticles(ANALYZE_BATCH_SIZE);
  let analyzed = 0;
  let failed = 0;

  for (let i = 0; i < unanalyzed.length; i++) {
    const result = await analyzeArticle(unanalyzed[i].id);
    if (result.ok) {
      analyzed++;
    } else {
      console.error("[cron/run-all] analyze failed", unanalyzed[i].id, result.error);
      failed++;
    }
    if (i < unanalyzed.length - 1) {
      await new Promise((r) => setTimeout(r, ANALYZE_DELAY_MS));
    }
  }

  return { queued: unanalyzed.length, analyzed, failed };
}

/**
 * GET /api/cron/run-all
 * Single cron job that runs the full pipeline:
 * 1. Ingest — fetch RSS and store new articles (~10s)
 * 2. Analyze — drip-feed unanalyzed articles through Groq with 4s delays (~40s for 10)
 * 3. Pipeline part 1 — events → features → signals (~30-50s)
 * 4. Prune — remove old articles
 * 5. Weekly tasks (conditional) — Wed: fundamentals, Sun: pipeline part 2 + weekly summary
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const origin = request.nextUrl.origin;
  const startedAt = new Date().toISOString();
  const out: StepResult = { ok: true, startedAt };

  await runStep(out, "ingest", () => fetchAndIngestNews());

  if (getAnalyzeConfig()) {
    await runStep(out, "analyze", analyzeUnanalyzedArticles);
  } else {
    out.analyze = { skipped: "No GROQ_API_KEY or OPENAI_API_KEY set." };
  }

  await runStep(out, "pipelinePart1", runPipelinePart1, true);
  await runStep(out, "prune", () => callInternalCron(origin, "/api/cron/prune-articles"));

  const utcDay = new Date().getUTCDay();
  if (utcDay === 3) {
    await runStep(out, "fundamentals", () => callInternalCron(origin, "/api/cron/fetch-fundamentals"));
  }
  if (utcDay === 0) {
    await runStep(out, "pipelinePart2", runPipelinePart2, true);
    await runStep(out, "weeklySummary", () => callInternalCron(origin, "/api/cron/generate-weekly-summary"));
  }

  const finishedAt = new Date().toISOString();
  out.finishedAt = finishedAt;
  out.durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  return NextResponse.json(out, { status: out.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
