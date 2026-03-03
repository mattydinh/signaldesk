/**
 * ML pipeline: unified event model.
 * Dual-write from ingest so events table stays in sync with news (and future Twitter).
 * Uses Supabase REST when available (no Postgres password needed); else Prisma.
 */
import { prisma } from "@/lib/db";
import { getSupabaseAdmin, hasSupabaseDb } from "@/lib/supabase-server";

export type CreateEventInput = {
  id: string;
  source: "news" | "twitter";
  publishedAt: Date;
  rawText: string;
  cleanText?: string | null;
  entities?: string[];
  categories?: string[];
  url?: string | null;
};

/**
 * Create an event (e.g. from a newly ingested article).
 * Use article id as event id for 1:1 link. Uses Supabase when available so no Postgres password is needed.
 */
export async function createEventFromArticle(input: {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  publishedAt?: string | null;
}): Promise<void> {
  return createEventsFromArticles([input]);
}

/**
 * Batch-create events from newly ingested articles.
 * Uses a single Supabase upsert instead of N sequential calls.
 */
export async function createEventsFromArticles(inputs: {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  publishedAt?: string | null;
}[]): Promise<void> {
  if (inputs.length === 0) return;
  const now = new Date().toISOString();
  const rows = inputs.map((input) => {
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
    const rawText = [input.title, input.summary].filter(Boolean).join("\n") || input.title;
    return {
      id: input.id,
      source: "news",
      published_at: publishedAt.toISOString(),
      raw_text: rawText,
      clean_text: null,
      entities: [],
      categories: [],
      url: input.url ?? null,
      created_at: now,
    };
  });

  if (hasSupabaseDb()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Chunk to avoid request size limits
        const CHUNK = 100;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          await (supabase as any).from("Event").upsert(chunk, { onConflict: "id" });
        }
      }
    } catch (e) {
      console.error("[events] createEventsFromArticles (Supabase)", e);
    }
    return;
  }

  // Prisma fallback: batch via createMany (skip duplicates)
  try {
    await prisma.event.createMany({
      data: rows.map((r) => ({
        id: r.id,
        source: "news",
        publishedAt: new Date(r.published_at),
        rawText: r.raw_text,
        cleanText: null,
        entities: [],
        categories: [],
        url: r.url,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("[events] createEventsFromArticles (Prisma)", e);
  }
}

/**
 * Sync AI-assigned categories from Article to the corresponding Event (same id).
 * Called after analyze so the pipeline uses Event.categories when present; fallback remains inferCategoriesFromText.
 */
export async function syncEventCategoriesFromArticle(articleId: string, categories: string[]): Promise<void> {
  if (hasSupabaseDb()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await (supabase as any).from("Event").update({ categories }).eq("id", articleId);
      }
    } catch (e) {
      console.error("[events] syncEventCategoriesFromArticle (Supabase)", e);
    }
    return;
  }
  try {
    await prisma.event.update({
      where: { id: articleId },
      data: { categories },
    });
  } catch (e) {
    console.error("[events] syncEventCategoriesFromArticle (Prisma)", e);
  }
}
