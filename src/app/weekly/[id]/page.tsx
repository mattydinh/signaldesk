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
      <header className="sticky top-0 z-10 glass h-16">
        <div className="mx-auto flex h-full max-w-feed items-center justify-between px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-8" aria-label="Main">
            <Link href="/" className="text-body font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn">
              SignalDesk
            </Link>
            <Link href="/dashboard" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">Dashboard</Link>
            <Link href="/weekly" className="text-body text-[#FAFAFA] focus-visible:underline">Weekly</Link>
          </nav>
          <div className="flex items-center gap-4">
            {process.env.DASHBOARD_PASSWORD ? (
              <form action="/api/auth/logout" method="POST" className="inline">
                <button type="submit" className="text-body text-[#A1A1AA] hover:text-foreground focus-visible:underline transition-colors">Sign out</button>
              </form>
            ) : null}
            <span className="hidden text-body text-[#A1A1AA] sm:inline">Financial & Political Intelligence</span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/weekly" className="text-body text-[#A1A1AA] hover:text-foreground focus-visible:underline mb-8 inline-block">
          ← Back to Weekly Briefs
        </Link>

        <p className="text-meta text-[#71717A]">{formatWeekRange(summary.weekStart, summary.weekEnd)}</p>
        <h1 className="mt-2 text-page-title text-foreground">{summary.title}</h1>

        <div className="mt-6 flex items-center gap-3">
          <span className="text-meta text-[#71717A]">Risk level:</span>
          <div className="h-2 w-24 rounded-pill bg-[#27272A] overflow-hidden flex">
            <div
              className={`h-full rounded-pill ${score != null && score >= 4 ? "escalation-high" : score != null && score >= 3 ? "escalation-moderate" : "escalation-low"}`}
              style={{ width: score != null ? `${(score / 5) * 100}%` : "0%" }}
            />
          </div>
          <span
            className={`rounded-badge px-3 py-1 text-meta font-medium ${
              score != null && score >= 4 ? "signal-negative" : score != null && score >= 3 ? "bg-[rgba(251,191,36,0.1)] text-[#FBBF24]" : "signal-neutral"
            }`}
          >
            {riskLabel}
          </span>
        </div>

        <section className="mt-16" aria-labelledby="executive-heading">
          <h2 id="executive-heading" className="text-meta uppercase tracking-wide text-[#71717A] mb-2">
            Executive Summary
          </h2>
          <p className="text-body text-foreground leading-relaxed">{summary.summaryText}</p>
        </section>

        {trends.length > 0 && (
          <section className="mt-16" aria-labelledby="trends-heading">
            <h2 id="trends-heading" className="text-meta uppercase tracking-wide text-[#71717A] mb-4">
              Key Trends
            </h2>
            <ul className="list-inside list-disc space-y-2 text-body text-foreground">
              {trends.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        {geo && (geo.narrativeShift || (geo.escalationLevel != null && geo.escalationLevel > 0)) && (
          <section className="mt-16" aria-labelledby="geo-heading">
            <h2 id="geo-heading" className="text-meta uppercase tracking-wide text-[#71717A] mb-4">
              Geopolitical Assessment
            </h2>
            <div className="rounded-card border border-[#27272A] bg-[#18181B]/40 p-5 text-body">
              {geo.narrativeShift && <p className="text-foreground">{geo.narrativeShift}</p>}
              {geo.escalationLevel != null && (
                <p className="mt-2 text-[#A1A1AA]">Escalation level: {geo.escalationLevel}/5</p>
              )}
            </div>
          </section>
        )}

        {sectors.length > 0 && (
          <section className="mt-16" aria-labelledby="sectors-heading">
            <h2 id="sectors-heading" className="text-meta uppercase tracking-wide text-[#71717A] mb-4">
              Sector Impact
            </h2>
            <div className="overflow-x-auto rounded-card border border-[#27272A]">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-[#27272A] bg-[#18181B]/40">
                    <th className="px-4 py-3 text-left font-medium text-foreground">Sector</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Direction</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((row, i) => (
                    <tr key={i} className="border-b border-[#27272A]/60">
                      <td className="px-4 py-3 text-foreground">{row.sector}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-badge px-3 py-0.5 text-meta font-medium ${
                            row.direction === "Positive" ? "signal-positive" : row.direction === "Negative" ? "signal-negative" : "signal-neutral"
                          }`}
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#A1A1AA]">{row.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {implications.length > 0 && (
          <section className="mt-16" aria-labelledby="implications-heading">
            <h2 id="implications-heading" className="text-meta uppercase tracking-wide text-[#71717A] mb-4">
              Investor Implications
            </h2>
            <ul className="list-inside list-disc space-y-2 text-body text-foreground">
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
