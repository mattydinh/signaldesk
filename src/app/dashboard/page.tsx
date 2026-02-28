import { Suspense } from "react";
import Link from "next/link";
import DashboardFilters from "./DashboardFilters";
import AnalyzeButton from "./AnalyzeButton";

const base =
  process.env.VERCEL_URL != null
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getSources() {
  const res = await fetch(`${base}/api/sources`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { sources: Array<{ id: string; name: string }> };
  return data.sources;
}

async function ArticlesList({
  q,
  sourceId,
}: {
  q: string | null;
  sourceId: string | null;
}) {
  const params = new URLSearchParams({ limit: "20" });
  if (q) params.set("q", q);
  if (sourceId) params.set("sourceId", sourceId);
  const res = await fetch(`${base}/api/articles?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return (
      <p className="text-muted-foreground text-sm">
        Could not load articles. Is the database connected?
      </p>
    );
  }
  const data = (await res.json()) as {
    articles: Array<{
      id: string;
      title: string;
      summary: string | null;
      url: string | null;
      publishedAt: string | null;
      implications: string | null;
      entities: string[];
      topics: string[];
      opportunities: string[];
      forShareholders: string | null;
      forInvestors: string | null;
      forBusiness: string | null;
      source: { name: string };
    }>;
    pagination: { total: number; pages: number };
  };

  if (data.articles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {q || sourceId
          ? "No articles match the filters."
          : "No articles yet. Use POST /api/news/ingest to add some."}
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {data.pagination.total} article{data.pagination.total !== 1 ? "s" : ""}
      </p>
      <ul className="mt-4 space-y-4">
        {data.articles.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {a.source.name}
                  {a.publishedAt &&
                    ` · ${new Date(a.publishedAt).toLocaleDateString()}`}
                </span>
                <h2 className="mt-1 font-semibold text-card-foreground">
                  {a.title}
                </h2>
                {a.summary && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {a.summary}
                  </p>
                )}
                {(a.entities?.length > 0 || a.topics?.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {a.entities?.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                    {a.topics?.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-primary/10 px-1.5 py-0.5 text-primary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {a.implications && (
                  <p className="mt-2 text-sm font-medium text-primary">
                    {a.implications}
                  </p>
                )}
                {(a.opportunities?.length > 0 || a.forShareholders || a.forInvestors || a.forBusiness) && (
                  <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
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
                <AnalyzeButton articleId={a.id} />
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-input px-2 py-1 text-xs hover:bg-accent"
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
  searchParams: Promise<{ q?: string; sourceId?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? null;
  const sourceId = params.sourceId ?? null;

  const sources = await getSources();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            SignalDesk
          </Link>
          <span className="text-sm text-muted-foreground">
            Financial & Political Intelligence
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Intelligence feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opportunities and implications for shareholders, investors, and business leaders.
        </p>
        <DashboardFilters sources={sources} />
        <Suspense
          fallback={
            <p className="mt-6 text-muted-foreground">Loading articles…</p>
          }
        >
          <div className="mt-6">
            <ArticlesList q={q} sourceId={sourceId} />
          </div>
        </Suspense>
      </main>
    </div>
  );
}
