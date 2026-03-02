import { NextRequest, NextResponse } from "next/server";
import { fetchAndIngestNews } from "@/lib/fetch-news";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase } from "@/lib/data-supabase";
import { runPipeline } from "@/lib/pipeline/run";

const ANALYZE_BATCH = 3;
const ANALYZE_DELAY_MS = 400;
const BACKFILL_BATCH = 15;

async function runAnalyzeBatch(ids: string[], origin: string): Promise<void> {
  for (let i = 0; i < ids.length; i += ANALYZE_BATCH) {
    const batch = ids.slice(i, i + ANALYZE_BATCH);
    await Promise.all(
      batch.map((id) =>
        fetch(`${origin}/api/articles/${id}/analyze`, { method: "POST" }).catch(() => null)
      )
    );
    if (i + ANALYZE_BATCH < ids.length) {
      await new Promise((r) => setTimeout(r, ANALYZE_DELAY_MS));
    }
  }
}

export const maxDuration = 120;

/**
 * GET /api/cron/ingest-news
 * Fetches headlines from configured RSS feeds, ingests them, and auto-tags new articles.
 * Also runs the ML pipeline to populate Intelligence (signals, regime, backtest).
 * Set GROQ_API_KEY or OPENAI_API_KEY to auto-tag. CRON_SECRET required.
 */
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

  const result = await fetchAndIngestNews();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const origin = request.nextUrl.origin;
  const hasAnalyze = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);

  if (hasAnalyze) {
    const newIds = result.newArticleIds ?? [];
    if (newIds.length > 0) {
      await runAnalyzeBatch(newIds, origin);
    }
    // Backfill: tag existing articles that still have no categories (e.g. from before auto-tag existed)
    if (hasSupabaseDb()) {
      const { articles } = await getArticlesSupabase({ limit: 150, offset: 0 });
      const needTags = articles
        .filter((a) => !a.categories || a.categories.length === 0)
        .slice(0, BACKFILL_BATCH)
        .map((a) => a.id);
      if (needTags.length > 0) {
        await runAnalyzeBatch(needTags, origin);
      }
    }
  }

  // Populate Intelligence: run ML pipeline after ingest (events → signals → regime → backtest)
  try {
    await runPipeline();
  } catch (e) {
    console.error("[ingest-news] pipeline run failed", e);
    // Don't fail the cron; ingest succeeded
  }

  return NextResponse.json(result);
}
