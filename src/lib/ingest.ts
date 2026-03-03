import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { ingestArticlesSupabase } from "@/lib/data-supabase";

export type IngestArticle = {
  externalId?: string;
  sourceName: string;
  sourceSlug?: string;
  sourceBaseUrl?: string;
  title: string;
  summary?: string;
  url?: string;
  publishedAt?: string;
  rawPayload?: unknown;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function ingestArticles(articles: IngestArticle[]): Promise<{
  created: number;
  skipped: number;
  total: number;
  newArticleIds: string[];
}> {
  if (hasSupabaseDb()) {
    return ingestArticlesSupabase(articles);
  }

  let created = 0;
  let skipped = 0;
  const newArticleIds: string[] = [];

  for (const a of articles) {
    if (!a.title || !a.sourceName) {
      skipped++;
      continue;
    }

    const slug = a.sourceSlug ?? slugify(a.sourceName);

    const source = await prisma.source.upsert({
      where: { slug },
      create: {
        name: a.sourceName,
        slug,
        baseUrl: a.sourceBaseUrl ?? null,
      },
      update: {},
    });

    const publishedAt = a.publishedAt ? new Date(a.publishedAt) : null;

    const existing = a.externalId
      ? await prisma.article.findFirst({
          where: { sourceId: source.id, externalId: a.externalId },
        })
      : null;

    if (existing) {
      skipped++;
      continue;
    }

    const newArticle = await prisma.article.create({
      data: {
        sourceId: source.id,
        externalId: a.externalId ?? null,
        title: a.title,
        summary: a.summary ?? null,
        url: a.url ?? null,
        publishedAt,
        rawPayload:
          a.rawPayload == null
            ? undefined
            : (a.rawPayload as Prisma.InputJsonValue),
      },
    });
    created++;
    newArticleIds.push(newArticle.id);
  }

  return { created, skipped, total: articles.length, newArticleIds };
}
