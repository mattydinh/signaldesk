import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 60;

function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function escalationLabel(score: number | null): string {
  if (score == null) return "—";
  if (score <= 2) return "Low";
  if (score <= 3) return "Moderate";
  return "Elevated";
}

export default async function WeeklyPage() {
  let summaries: Awaited<ReturnType<typeof prisma.weeklySummary.findMany>> = [];
  try {
    summaries = await prisma.weeklySummary.findMany({
      orderBy: { weekStart: "desc" },
      take: 4,
    });
  } catch (e) {
    // Table may not exist yet (run prisma/scripts/create-weekly-summary-table.sql in Supabase)
    console.error("[weekly] fetch error", e);
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-10 glass border-b border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <nav className="flex items-center gap-6" aria-label="Main">
            <Link
              href="/"
              className="text-body-lg font-bold tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn"
            >
              SignalDesk
            </Link>
            <Link
              href="/dashboard"
              className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:underline transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/weekly"
              className="text-body-sm font-medium text-foreground focus-visible:underline"
              aria-current="page"
            >
              Weekly
            </Link>
          </nav>
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
        <section aria-labelledby="weekly-heading">
          <h1 id="weekly-heading" className="text-display-sm text-foreground tracking-tight sm:text-display-md">
            Weekly Intelligence Brief
          </h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            China geopolitics, US conflict exposure, and investor sector impact.
          </p>
        </section>

        {summaries.length === 0 ? (
          <div className="mt-10 space-y-4 text-body-sm text-muted-foreground">
            <p>No briefs yet. The first one will appear after the weekly job runs (Sundays at 6 PM UTC).</p>
            <p className="rounded-card border border-border/60 bg-muted/20 p-4 text-caption">
              <strong className="text-foreground">One-time setup:</strong> If this is your first time, run the SQL in{" "}
              <code className="rounded bg-muted px-1">prisma/scripts/create-weekly-summary-table.sql</code> in Supabase
              → SQL Editor so the Weekly Summary table exists.
            </p>
          </div>
        ) : (
          <ul className="mt-10 space-y-6" role="list" aria-label="Weekly briefs">
            {summaries.map((s) => {
              const score = s.geopoliticalScore;
              const trends = Array.isArray(s.keyTrends) ? (s.keyTrends as string[]) : [];
              return (
                <li
                  key={s.id}
                  className="glass-card card-hover accent-bar rounded-card p-6"
                  aria-labelledby={`brief-title-${s.id}`}
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-caption font-medium text-muted-foreground">
                      {formatWeekRange(s.weekStart, s.weekEnd)}
                    </p>
                    <h2 id={`brief-title-${s.id}`} className="text-body-lg font-semibold text-card-foreground">
                      {s.title}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-muted-foreground">Escalation:</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-caption font-medium ${
                          score != null && score >= 4
                            ? "bg-destructive/20 text-destructive"
                            : score != null && score >= 3
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {escalationLabel(score)}
                      </span>
                    </div>
                    {trends.length > 0 && (
                      <ul className="list-inside list-disc space-y-1 text-body-sm text-muted-foreground">
                        {trends.slice(0, 3).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/weekly/${s.id}`}
                      className="mt-2 inline-flex w-fit rounded-btn border border-border bg-secondary px-4 py-2 text-caption font-medium text-secondary-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      View Full Brief
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
