/**
 * GET /api/cron/backfill-events
 * One-time backfill: for each article in Supabase that doesn't have an Event yet,
 * create an Event row so the ML pipeline has data to process.
 * If ?runPipeline=1 (or run_pipeline=1), runs the ML pipeline after backfill so Intelligence page populates.
 * Call with CRON_SECRET in header or ?secret=
 */
import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseDb, getSupabaseAdmin } from "@/lib/supabase-server";
import { createEventFromArticle } from "@/lib/events";
import { runPipeline } from "@/lib/pipeline/run";

const ARTICLE_TABLE = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  if (!hasSupabaseDb()) {
    return NextResponse.json({ error: "Supabase must be configured." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not available." }, { status: 503 });
  }
  const sb = supabase as any;

  const { data: articles } = await sb
    .from(ARTICLE_TABLE)
    .select("id, title, summary, url, publishedAt")
    .limit(500);
  if (!articles?.length) {
    return NextResponse.json({ ok: true, backfilled: 0, message: "No articles in Supabase." });
  }

  const { data: existingEvents } = await sb.from("Event").select("id").in("id", articles.map((a: { id: string }) => a.id));
  const existingIds = new Set((existingEvents ?? []).map((e: { id: string }) => e.id));

  let backfilled = 0;
  for (const a of articles as { id: string; title: string; summary?: string | null; url?: string | null; publishedAt?: string | null }[]) {
    if (existingIds.has(a.id)) continue;
    await createEventFromArticle({
      id: a.id,
      title: a.title,
      summary: a.summary ?? null,
      url: a.url ?? null,
      publishedAt: a.publishedAt ?? null,
    });
    backfilled++;
  }

  const runPipelineParam = request.nextUrl.searchParams.get("runPipeline") ?? request.nextUrl.searchParams.get("run_pipeline");
  let pipelineResults: Record<string, unknown> | null = null;
  if (runPipelineParam === "1" || runPipelineParam === "true") {
    try {
      pipelineResults = await runPipeline();
    } catch (e) {
      console.error("[backfill-events] pipeline run failed", e);
      pipelineResults = { error: e instanceof Error ? e.message : "Pipeline failed" };
    }
  }

  return NextResponse.json({
    ok: true,
    backfilled,
    totalArticles: articles.length,
    message: backfilled > 0 ? `Created ${backfilled} Event(s).` : "All articles already have Events.",
    ...(pipelineResults != null && { pipeline: pipelineResults }),
  });
}
