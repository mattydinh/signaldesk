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
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
  const rawText = [input.title, input.summary].filter(Boolean).join("\n") || input.title;
  const row = {
    id: input.id,
    source: "news",
    published_at: publishedAt.toISOString(),
    raw_text: rawText,
    clean_text: null,
    entities: [],
    categories: [],
    url: input.url ?? null,
  };

  if (hasSupabaseDb()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await (supabase as any).from("Event").upsert(row, { onConflict: "id" });
      }
    } catch (e) {
      console.error("[events] createEventFromArticle (Supabase)", e);
    }
    return;
  }

  try {
    await prisma.event.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        source: "news",
        publishedAt,
        rawText,
        cleanText: null,
        entities: [],
        categories: [],
        url: input.url ?? null,
      },
      update: {},
    });
  } catch (e) {
    console.error("[events] createEventFromArticle (Prisma)", e);
  }
}
