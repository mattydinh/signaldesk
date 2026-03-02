import { Suspense } from "react";
import Link from "next/link";
import DashboardFilters from "./DashboardFilters";
import AnalyzeButton from "./AnalyzeButton";
import FetchNewsButton from "./FetchNewsButton";
import { getCategoryTagStyle, inferCategoriesFromText } from "@/lib/categories";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase, getSourcesSupabase } from "@/lib/data-supabase";

export const dynamic = "force-dynamic";

const base =
  process.env.VERCEL_URL != null
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type ArticleForList = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string | null;
  implications: string | null;
  entities: string[];
  topics: string[];
  categories: string[];
  opportunities: string[];
  forShareholders: string | null;
  forInvestors: string | null;
  forBusiness: string | null;
  source: { name: string };
};

async function getArticlesForList(
  q: string | null,
  category: string | null
): Promise<{ articles: ArticleForList[]; total: number }> {
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
    const articlesWithSource: ArticleForList[] = articles.map((a) => ({
      ...a,
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
  const data = (await res.json()) as { articles: ArticleForList[]; pagination: { total: number } };
  return { articles: data.articles, total: data.pagination.total };
}

async function ArticlesList({
  q,
  category,
  hasAnalyzeProvider,
}: {
  q: string | null;
  category: string | null;
  hasAnalyzeProvider: boolean;
}) {
  let articles: ArticleForList[];
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
          : "No articles yet. Use “Fetch news now” to load the latest headlines."}
      </p>
    );
  }

  return (
    <>
      <p className="text-meta font-medium text-[#A1A1AA]">
        {total} article{total !== 1 ? "s" : ""}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Intelligence feed articles">
        {articles.map((a) => (
          <li
            key={a.id}
            className="glass-card card-hover accent-bar rounded-card border border-[#27272A] p-6"
            aria-labelledby={`article-title-${a.id}`}
          >
            <div className="flex flex-col gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-meta text-[#71717A]">
                  {a.source.name}
                  {a.publishedAt &&
                    ` · ${new Date(a.publishedAt).toLocaleDateString()}`}
                </span>
                <h2
                  id={`article-title-${a.id}`}
                  className="mt-2 text-card-title text-foreground"
                >
                  {a.title}
                </h2>
                {a.summary && (
                  <p className="mt-2 text-body text-[#A1A1AA] line-clamp-2 leading-relaxed">
                    {a.summary}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Article tags">
                  {((a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null)).slice(0, 3)).map((c) => {
                    const tagStyle = getCategoryTagStyle(c);
                    return (
                      <span
                        key={c}
                        className="rounded-badge border px-3 py-1 text-meta font-medium"
                        style={{
                          backgroundColor: tagStyle.backgroundColor,
                          color: tagStyle.color,
                          borderColor: tagStyle.borderColor,
                        }}
                      >
                        {c}
                      </span>
                    );
                  })}
                  {a.entities?.slice(0, 4).map((e) => (
                    <span
                      key={e}
                      className="rounded-badge bg-[#18181B]/80 px-3 py-1 text-meta text-[#A1A1AA]"
                    >
                      {e}
                    </span>
                  ))}
                  {a.topics?.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-badge signal-neutral px-3 py-1 text-meta font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {a.implications && (
                  <p className="mt-4 text-body font-medium leading-relaxed signal-positive">
                    {a.implications}
                  </p>
                )}
                {(a.opportunities?.length > 0 || a.forShareholders || a.forInvestors || a.forBusiness) && (
                  <div className="mt-6 space-y-4 rounded-card border border-[#27272A] bg-[#18181B]/40 p-5 text-body">
                    {a.opportunities?.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-meta uppercase tracking-wide text-[#71717A]">
                          Opportunities
                        </h3>
                        <ul className="list-inside list-disc space-y-1 text-foreground">
                          {a.opportunities.map((opp) => (
                            <li key={opp}>{opp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.forShareholders && (
                      <div>
                        <h3 className="mb-1 text-meta uppercase tracking-wide text-[#71717A]">
                          For shareholders
                        </h3>
                        <p className="text-foreground">{a.forShareholders}</p>
                      </div>
                    )}
                    {a.forInvestors && (
                      <div>
                        <h3 className="mb-1 text-meta uppercase tracking-wide text-[#71717A]">
                          For investors
                        </h3>
                        <p className="text-foreground">{a.forInvestors}</p>
                      </div>
                    )}
                    {a.forBusiness && (
                      <div>
                        <h3 className="mb-1 text-meta uppercase tracking-wide text-[#71717A]">
                          For business
                        </h3>
                        <p className="text-foreground">{a.forBusiness}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 mt-auto">
                {hasAnalyzeProvider && !a.id.startsWith("cache-") && <AnalyzeButton articleId={a.id} />}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-badge border border-[#27272A] bg-[#18181B] px-4 py-2 text-body font-medium text-foreground hover:bg-[#27272A] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150"
                    aria-label="Open article in new tab"
                  >
                    Open
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
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
            <ArticlesList
              q={q}
              category={category}
              hasAnalyzeProvider={!!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY)}
            />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
