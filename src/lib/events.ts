/**
 * ML pipeline: unified event model.
 * Dual-write from ingest so events table stays in sync with news (and future Twitter).
 */
import { prisma } from "@/lib/db";

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
 * Use article id as event id for 1:1 link. No-op if Prisma is unavailable or insert fails.
 */
export async function createEventFromArticle(input: {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  publishedAt?: string | null;
}): Promise<void> {
  try {
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
    const rawText = [input.title, input.summary].filter(Boolean).join("\n") || input.title;
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
    console.error("[events] createEventFromArticle", e);
  }
}
