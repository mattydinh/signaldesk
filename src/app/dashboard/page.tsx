import { Suspense } from "react";
import Link from "next/link";
import DashboardFilters from "./DashboardFilters";
import FetchNewsButton from "./FetchNewsButton";
import ArticleFeed from "./ArticleFeed";
import type { Article } from "./types";
import { inferCategoriesFromText } from "@/lib/categories";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase, getSourcesSupabase } from "@/lib/data-supabase";

export const dynamic = "force-dynamic";

const base =
  process.env.VERCEL_URL != null
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getArticlesForList(
  q: string | null,
  category: string | null
): Promise<{ articles: Article[]; total: number }> {
  const retentionDays =
    typeof process.env.ARTICLE_RETENTION_DAYS !== "undefined"
      ? parseInt(process.env.ARTICLE_RETENTION_DAYS, 10)
      : 30;
  if (hasSupabaseDb()) {
    const { articles, total } = await getArticlesSupabase({
      limit: 50,
      offset: 0,
      q: q ?? undefined,
      category: category ?? undefined,
      retentionDays: Number.isNaN(retentionDays) ? 30 : retentionDays,
    });
    const sources = await getSourcesSupabase();
    const sourceMap = new Map(sources.map((s) => [s.id, s.name]));
    const articlesWithSource: Article[] = articles.map((a) => ({
      ...a,
      categories: a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null),
      source: {
        name: (a as { sourceName?: string }).sourceName ?? sourceMap.get(a.sourceId) ?? "Unknown",
      },
    }));
    return { articles: articlesWithSource, total };
  }
  const params = new URLSearchParams({ limit: "20" });
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const res = await fetch(`${base}/api/articles?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load articles");
  const data = (await res.json()) as { articles: Article[]; pagination: { total: number } };
  return { articles: data.articles, total: data.pagination.total };
}

async function ArticlesList({
  q,
  category,
}: {
  q: string | null;
  category: string | null;
}) {
  let articles: Article[];
  let total: number;
  try {
    const data = await getArticlesForList(q, category);
    articles = data.articles;
    total = data.total;
  } catch {
    return (
      <p className="text-body-sm text-muted-foreground">
        Could not load articles. Check your connection and try again.
      </p>
    );
  }

  if (articles.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        {q
          ? "No articles match your search."
          : "No articles yet. Use \u201cFetch news now\u201d to load the latest headlines."}
      </p>
    );
  }

  return (
    <>
      <p className="text-meta font-medium text-[#A1A1AA]">
        {total} article{total !== 1 ? "s" : ""}
      </p>
      <ArticleFeed articles={articles} />
    </>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? null;
  const category = params.category ?? null;

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-10 glass h-16">
        <div className="mx-auto flex h-full max-w-feed items-center justify-between px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-8" aria-label="Main">
            <Link
              href="/"
              className="text-body font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn"
            >
              SignalDesk
            </Link>
            <Link
              href="/dashboard"
              className="text-body text-[#FAFAFA] focus-visible:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/weekly"
              className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
            >
              Weekly
            </Link>
            <Link
              href="/intelligence"
              className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
            >
              Intelligence
            </Link>
            <Link
              href="/features"
              className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
            >
              Features (beta)
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {process.env.DASHBOARD_PASSWORD ? (
              <form action="/api/auth/logout" method="POST" className="inline">
                <button
                  type="submit"
                  className="text-body text-[#A1A1AA] hover:text-foreground focus-visible:underline transition-colors"
                >
                  Sign out
                </button>
              </form>
            ) : null}
            <span className="hidden text-body text-[#A1A1AA] sm:inline">
              Financial & Political Intelligence
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
        <section className="space-y-4 mb-16" aria-labelledby="feed-heading">
          <h1 id="feed-heading" className="text-page-title text-foreground">
            Intelligence feed
          </h1>
          <p className="text-body text-[#A1A1AA]">
            Opportunities and implications for shareholders, investors, and business leaders.
          </p>
          <p className="text-body text-[#71717A] max-w-2xl">
            This feed continuously aggregates and analyzes relevant finance and political news, updating in real time. New articles are added regularly to keep you informed.
          </p>
          <p className="mt-2">
            <Link href="/dashboard/audit-tags" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline">
              Tag audit
            </Link>
            <span className="text-meta text-[#71717A] ml-2">— spot-check AI-assigned categories before using them for signals.</span>
          </p>
        </section>

        <section className="mb-16" aria-label="Filters and actions">
          <div className="flex flex-wrap items-end gap-6">
            <DashboardFilters />
            <FetchNewsButton />
          </div>
        </section>

        <section aria-label="Article list" className="space-y-16">
          <Suspense
            fallback={
              <p className="text-body-sm text-muted-foreground animate-pulse">Loading articles…</p>
            }
          >
            <ArticlesList q={q} category={category} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
