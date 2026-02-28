import { Suspense } from "react";
import Link from "next/link";
import DashboardFilters from "./DashboardFilters";
import AnalyzeButton from "./AnalyzeButton";
import FetchNewsButton from "./FetchNewsButton";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase, getSourcesSupabase } from "@/lib/data-supabase";

export const dynamic = "force-dynamic";

const base =
  process.env.VERCEL_URL != null
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getSources() {
  if (hasSupabaseDb()) {
    return getSourcesSupabase();
  }
  const res = await fetch(`${base}/api/sources`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { sources: Array<{ id: string; name: string }> };
  return data.sources;
}

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
  sourceId: string | null,
  category: string | null
): Promise<{ articles: ArticleForList[]; total: number }> {
  if (hasSupabaseDb()) {
    const { articles, total } = await getArticlesSupabase({
      limit: 50,
      offset: 0,
      sourceId: sourceId ?? undefined,
      category: category ?? undefined,
      q: q ?? undefined,
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
  if (sourceId) params.set("sourceId", sourceId);
  const res = await fetch(`${base}/api/articles?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load articles");
  const data = (await res.json()) as { articles: ArticleForList[]; pagination: { total: number } };
  return { articles: data.articles, total: data.pagination.total };
}

async function ArticlesList({
  q,
  sourceId,
  category,
  hasAnalyzeProvider,
}: {
  q: string | null;
  sourceId: string | null;
  category: string | null;
  hasAnalyzeProvider: boolean;
}) {
  let articles: ArticleForList[];
  let total: number;
  try {
    const data = await getArticlesForList(q, sourceId, category);
    articles = data.articles;
    total = data.total;
  } catch {
    return (
      <p className="text-muted-foreground text-sm">
        Could not load articles. Is the database connected?
      </p>
    );
  }

  if (articles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {q || sourceId || category
          ? "No articles match the filters."
          : "No articles yet. Click “Fetch news now” above to load headlines (add NEWS_API_KEY to .env locally or in Vercel)."}
      </p>
    );
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {total} article{total !== 1 ? "s" : ""}
      </p>
      <ul className="mt-4 space-y-4">
        {articles.map((a) => (
          <li
            key={a.id}
            className="glass-card card-hover accent-bar rounded-xl p-4 sm:p-5 pl-5 sm:pl-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {a.source.name}
                  {a.publishedAt &&
                    ` · ${new Date(a.publishedAt).toLocaleDateString()}`}
                </span>
                <h2 className="mt-1.5 text-base font-semibold leading-snug text-card-foreground sm:text-lg">
                  {a.title}
                </h2>
                {a.summary && (
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {a.summary}
                  </p>
                )}
                {(a.categories?.length > 0 || a.entities?.length > 0 || a.topics?.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {a.categories?.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary"
                      >
                        {c}
                      </span>
                    ))}
                    {a.entities?.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="rounded-md bg-muted/80 px-2 py-0.5 text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                    {a.topics?.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-primary/15 px-2 py-0.5 font-medium text-primary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {a.implications && (
                  <p className="mt-3 text-sm font-medium leading-relaxed text-primary">
                    {a.implications}
                  </p>
                )}
                {(a.opportunities?.length > 0 || a.forShareholders || a.forInvestors || a.forBusiness) && (
                  <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                    {a.opportunities?.length > 0 && (
                      <div>
                        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Opportunities
                        </h3>
                        <ul className="list-inside list-disc space-y-0.5 text-card-foreground">
                          {a.opportunities.map((opp) => (
                            <li key={opp}>{opp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.forShareholders && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          For shareholders
                        </h3>
                        <p className="text-card-foreground">{a.forShareholders}</p>
                      </div>
                    )}
                    {a.forInvestors && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          For investors
                        </h3>
                        <p className="text-card-foreground">{a.forInvestors}</p>
                      </div>
                    )}
                    {a.forBusiness && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          For business
                        </h3>
                        <p className="text-card-foreground">{a.forBusiness}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasAnalyzeProvider && !a.id.startsWith("cache-") && <AnalyzeButton articleId={a.id} />}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
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
  searchParams: Promise<{ q?: string; sourceId?: string; category?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? null;
  const sourceId = params.sourceId ?? null;
  const category = params.category ?? null;

  const sources = await getSources();

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-10 glass border-b border-border/50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            SignalDesk
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            {process.env.DASHBOARD_PASSWORD ? (
              <form action="/api/auth/logout" method="POST" className="inline">
                <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign out
                </button>
              </form>
            ) : null}
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Financial & Political Intelligence
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Intelligence feed
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Opportunities and implications for shareholders, investors, and business leaders.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DashboardFilters sources={sources} />
          <FetchNewsButton />
        </div>
        <Suspense
          fallback={
            <p className="mt-6 text-muted-foreground animate-pulse">Loading articles…</p>
          }
        >
          <div className="mt-6">
            <ArticlesList
              q={q}
              sourceId={sourceId}
              category={category}
              hasAnalyzeProvider={!!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY)}
            />
          </div>
        </Suspense>
      </main>
    </div>
  );
}
