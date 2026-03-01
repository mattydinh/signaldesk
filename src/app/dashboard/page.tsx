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
      <p className="text-caption font-medium text-muted-foreground">
        {total} article{total !== 1 ? "s" : ""}
      </p>
      <ul className="mt-6 space-y-6" role="list" aria-label="Intelligence feed articles">
        {articles.map((a) => (
          <li
            key={a.id}
            className="glass-card card-hover accent-bar rounded-card p-6 pl-7"
            aria-labelledby={`article-title-${a.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-caption font-medium text-muted-foreground">
                  {a.source.name}
                  {a.publishedAt &&
                    ` · ${new Date(a.publishedAt).toLocaleDateString()}`}
                </span>
                <h2
                  id={`article-title-${a.id}`}
                  className="mt-2 text-body font-semibold leading-snug text-card-foreground sm:text-body-lg"
                >
                  {a.title}
                </h2>
                {a.summary && (
                  <p className="mt-2 text-body-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {a.summary}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Article tags">
                  {((a.categories?.length ? a.categories : inferCategoriesFromText(a.title ?? null, a.summary ?? null)).slice(0, 3)).map((c) => {
                    const tagStyle = getCategoryTagStyle(c);
                    return (
                      <span
                        key={c}
                        className="rounded-md border px-2.5 py-1 text-caption font-medium"
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
                      className="rounded-md bg-muted/80 px-2.5 py-1 text-caption text-muted-foreground"
                    >
                      {e}
                    </span>
                  ))}
                  {a.topics?.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-primary/15 px-2.5 py-1 text-caption font-medium text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {a.implications && (
                  <p className="mt-4 text-body-sm font-medium leading-relaxed text-primary">
                    {a.implications}
                  </p>
                )}
                {(a.opportunities?.length > 0 || a.forShareholders || a.forInvestors || a.forBusiness) && (
                  <div className="mt-6 space-y-4 rounded-btn border border-border/60 bg-muted/20 p-5 text-body-sm">
                    {a.opportunities?.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-overline uppercase tracking-wide text-muted-foreground">
                          Opportunities
                        </h3>
                        <ul className="list-inside list-disc space-y-1 text-card-foreground">
                          {a.opportunities.map((opp) => (
                            <li key={opp}>{opp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.forShareholders && (
                      <div>
                        <h3 className="mb-1 text-overline uppercase tracking-wide text-muted-foreground">
                          For shareholders
                        </h3>
                        <p className="text-card-foreground">{a.forShareholders}</p>
                      </div>
                    )}
                    {a.forInvestors && (
                      <div>
                        <h3 className="mb-1 text-overline uppercase tracking-wide text-muted-foreground">
                          For investors
                        </h3>
                        <p className="text-card-foreground">{a.forInvestors}</p>
                      </div>
                    )}
                    {a.forBusiness && (
                      <div>
                        <h3 className="mb-1 text-overline uppercase tracking-wide text-muted-foreground">
                          For business
                        </h3>
                        <p className="text-card-foreground">{a.forBusiness}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-start gap-2">
                {hasAnalyzeProvider && !a.id.startsWith("cache-") && <AnalyzeButton articleId={a.id} />}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-btn border border-border bg-secondary px-4 py-2 text-caption font-medium text-secondary-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
      <header className="sticky top-0 z-10 glass border-b border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="text-body-lg font-bold tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn"
          >
            SignalDesk
          </Link>
          <div className="flex items-center gap-4">
            {process.env.DASHBOARD_PASSWORD ? (
              <form action="/api/auth/logout" method="POST" className="inline">
                <button
                  type="submit"
                  className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:underline transition-colors"
                >
                  Sign out
                </button>
              </form>
            ) : null}
            <span className="hidden text-body-sm text-muted-foreground sm:inline">
              Financial & Political Intelligence
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-6 py-10">
        <section className="mb-10" aria-labelledby="feed-heading">
          <h1 id="feed-heading" className="text-display-sm text-foreground tracking-tight sm:text-display-md">
            Intelligence feed
          </h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            Opportunities and implications for shareholders, investors, and business leaders.
          </p>
          <p className="mt-4 text-body-sm text-muted-foreground max-w-2xl">
            This feed continuously aggregates and analyzes relevant finance and political news, updating in real time. New articles are added regularly to keep you informed.
          </p>
        </section>

        <section className="mb-10" aria-label="Filters and actions">
          <div className="flex flex-wrap items-end gap-6">
            <DashboardFilters />
            <FetchNewsButton />
          </div>
        </section>

        <section aria-label="Article list">
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
