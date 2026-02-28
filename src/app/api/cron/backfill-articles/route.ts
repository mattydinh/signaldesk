import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseDb, getSupabaseAdmin } from "@/lib/supabase-server";
import { hasBlobFeed, readFeedFromBlob } from "@/lib/feed-blob";

const SOURCE_TABLE = process.env.SUPABASE_SOURCE_TABLE ?? "Source";
const ARTICLE_TABLE = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * GET /api/cron/backfill-articles
 * One-time backfill: reads the Blob feed and upserts every article into Supabase
 * so the Article table has all items (not just the latest ingest).
 * Call with CRON_SECRET in header or ?secret= for auth.
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

  if (!hasSupabaseDb() || !hasBlobFeed()) {
    return NextResponse.json(
      { error: "Supabase and Blob must be configured." },
      { status: 400 }
    );
  }

  const feed = await readFeedFromBlob();
  if (!feed || feed.length === 0) {
    return NextResponse.json({ ok: true, backfilled: 0, message: "No feed in Blob." });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not available." }, { status: 503 });
  }
  const sb = supabase as any;

  let backfilled = 0;
  const errors: string[] = [];
  for (const a of feed) {
    if (!a.title || !a.sourceName) continue;

    const slug = slugify(a.sourceName);
    const { data: existingSource } = await sb.from(SOURCE_TABLE).select("id").eq("slug", slug).maybeSingle();
    let sourceId: string;
    if ((existingSource as { id?: string })?.id) {
      sourceId = (existingSource as { id: string }).id;
    } else {
      const { data: newSource, error: sourceErr } = await sb
        .from(SOURCE_TABLE)
        .insert({ name: a.sourceName, slug })
        .select("id")
        .single();
      if (sourceErr || !(newSource as { id?: string })?.id) {
        errors.push(`Source ${a.sourceName}: ${(sourceErr as Error)?.message ?? "no id"}`);
        continue;
      }
      sourceId = (newSource as { id: string }).id;
    }

    const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
    const { error: upsertErr } = await sb
      .from(ARTICLE_TABLE)
      .upsert(
        {
          id: a.id,
          sourceId,
          title: a.title,
          summary: a.summary ?? null,
          url: a.url ?? null,
          publishedAt,
          externalId: a.externalId ?? null,
        },
        { onConflict: "id" }
      );

    if (upsertErr) {
      errors.push(`Article ${a.id?.slice(0, 8)}: ${(upsertErr as Error)?.message ?? String(upsertErr)}`);
    } else {
      backfilled++;
    }
  }

  return NextResponse.json({
    ok: true,
    backfilled,
    total: feed.length,
    message: `Backfilled ${backfilled} of ${feed.length} articles into Supabase.`,
    ...(errors.length > 0 && { errors: errors.slice(0, 10), errorCount: errors.length }),
  });
}
