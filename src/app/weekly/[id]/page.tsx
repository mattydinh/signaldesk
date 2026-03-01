import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

type SectorImpact = { sector: string; direction: string; reasoning: string };
type InvestorSignal = {
  geopoliticalAssessment?: { escalationLevel?: number; narrativeShift?: string };
  investorImplications?: string[];
};

export default async function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let summary = null;
  try {
    summary = await prisma.weeklySummary.findUnique({ where: { id } });
  } catch (e) {
    console.error("[weekly/[id]] fetch error", e);
  }
  if (!summary) notFound();

  const trends = Array.isArray(summary.keyTrends) ? (summary.keyTrends as string[]) : [];
  const sectors = Array.isArray(summary.impactedSectors) ? (summary.impactedSectors as SectorImpact[]) : [];
  const signal = summary.investorSignal as InvestorSignal | null;
  const geo = signal?.geopoliticalAssessment;
  const implications = Array.isArray(signal?.investorImplications) ? (signal.investorImplications as string[]) : [];
  const score = summary.geopoliticalScore;
  const riskLabel =
    score == null ? "—" : score <= 2 ? "Low" : score <= 3 ? "Moderate" : "Elevated";

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
              className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:underline transition-colors"
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
        <Link
          href="/weekly"
          className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:underline mb-6 inline-block"
        >
          ← Back to Weekly Briefs
        </Link>

        <p className="text-caption font-medium text-muted-foreground">
          {formatWeekRange(summary.weekStart, summary.weekEnd)}
        </p>
        <h1 className="mt-2 text-display-sm text-foreground tracking-tight sm:text-display-md">
          {summary.title}
        </h1>

        <div className="mt-6 flex items-center gap-2">
          <span className="text-caption text-muted-foreground">Risk level:</span>
          <span
            className={`rounded-md px-2 py-1 text-caption font-medium ${
              score != null && score >= 4
                ? "bg-destructive/20 text-destructive"
                : score != null && score >= 3
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {riskLabel}
          </span>
        </div>

        <section className="mt-10" aria-labelledby="executive-heading">
          <h2 id="executive-heading" className="text-overline uppercase tracking-wide text-muted-foreground mb-2">
            Executive Summary
          </h2>
          <p className="text-body text-card-foreground leading-relaxed">{summary.summaryText}</p>
        </section>

        {trends.length > 0 && (
          <section className="mt-10" aria-labelledby="trends-heading">
            <h2 id="trends-heading" className="text-overline uppercase tracking-wide text-muted-foreground mb-4">
              Key Trends
            </h2>
            <ul className="list-inside list-disc space-y-2 text-body text-card-foreground">
              {trends.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        {geo && (geo.narrativeShift || (geo.escalationLevel != null && geo.escalationLevel > 0)) && (
          <section className="mt-10" aria-labelledby="geo-heading">
            <h2 id="geo-heading" className="text-overline uppercase tracking-wide text-muted-foreground mb-4">
              Geopolitical Assessment
            </h2>
            <div className="rounded-card border border-border/60 bg-muted/20 p-5 text-body-sm">
              {geo.narrativeShift && <p className="text-card-foreground">{geo.narrativeShift}</p>}
              {geo.escalationLevel != null && (
                <p className="mt-2 text-muted-foreground">Escalation level: {geo.escalationLevel}/5</p>
              )}
            </div>
          </section>
        )}

        {sectors.length > 0 && (
          <section className="mt-10" aria-labelledby="sectors-heading">
            <h2 id="sectors-heading" className="text-overline uppercase tracking-wide text-muted-foreground mb-4">
              Sector Impact
            </h2>
            <div className="overflow-x-auto rounded-card border border-border/60">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="px-4 py-3 text-left font-medium text-foreground">Sector</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Direction</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-4 py-3 text-card-foreground">{row.sector}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-caption font-medium ${
                            row.direction === "Positive"
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : row.direction === "Negative"
                                ? "bg-red-500/20 text-red-700 dark:text-red-400"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {implications.length > 0 && (
          <section className="mt-10" aria-labelledby="implications-heading">
            <h2 id="implications-heading" className="text-overline uppercase tracking-wide text-muted-foreground mb-4">
              Investor Implications
            </h2>
            <ul className="list-inside list-disc space-y-2 text-body text-card-foreground">
              {implications.map((imp, i) => (
                <li key={i}>{imp}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
