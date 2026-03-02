import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import GenerateBriefButton from "./GenerateBriefButton";
import RemoveBriefButton from "./RemoveBriefButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    console.error("[weekly] fetch error", e);
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-10 glass h-16">
        <div className="mx-auto flex h-full max-w-feed items-center justify-between px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-8" aria-label="Main">
            <Link href="/" className="text-body font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn">
              SignalDesk
            </Link>
            <Link href="/dashboard" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Dashboard
            </Link>
            <Link href="/weekly" className="text-body text-[#FAFAFA] focus-visible:underline" aria-current="page">
              Weekly
            </Link>
            <Link href="/intelligence" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Intelligence
            </Link>
            <Link href="/features" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Features (beta)
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {process.env.DASHBOARD_PASSWORD ? (
              <form action="/api/auth/logout" method="POST" className="inline">
                <button type="submit" className="text-body text-[#A1A1AA] hover:text-foreground focus-visible:underline transition-colors">
                  Sign out
                </button>
              </form>
            ) : null}
            <span className="hidden text-body text-[#A1A1AA] sm:inline">Financial & Political Intelligence</span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
        <section className="mb-16" aria-labelledby="weekly-heading">
          <h1 id="weekly-heading" className="text-page-title text-foreground">
            Weekly Intelligence Brief
          </h1>
            <p className="mt-2 text-body text-[#A1A1AA]">
            China geopolitics, US conflict exposure, and investor sector impact.
          </p>
          <p className="mt-2 text-meta text-[#71717A]">
            Briefs are generated once at the end of each week (Sunday 6 PM UTC) and summarize that week&apos;s events. They do not update when new articles are added later.
          </p>
          <p className="mt-1 text-meta text-[#71717A]">
            Next brief: Sunday 6 PM UTC. If the past week&apos;s brief is missing, generate it below.
          </p>
          <div className="mt-4">
            <GenerateBriefButton />
          </div>
        </section>

        {summaries.length === 0 ? (
          <div className="space-y-6 text-body text-[#A1A1AA]">
            <div className="flex justify-center">
              <Image src="/weekly-empty-placeholder.png" alt="" width={400} height={300} className="rounded-card object-cover" />
            </div>
            <p>No briefs yet. Use the “Generate weekly brief” button above to create one.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2" role="list" aria-label="Weekly briefs">
            {summaries.map((s) => {
              const score = s.geopoliticalScore;
              const trends = Array.isArray(s.keyTrends) ? (s.keyTrends as string[]) : [];
              return (
                <li
                  key={s.id}
                  className="glass-card card-hover accent-bar rounded-card border border-[#27272A] p-8"
                  aria-labelledby={`brief-title-${s.id}`}
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-meta text-[#71717A]">{formatWeekRange(s.weekStart, s.weekEnd)}</p>
                    <h2 id={`brief-title-${s.id}`} className="text-section-header text-foreground">
                      {s.title}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-meta text-[#71717A]">Escalation:</span>
                      <div className="h-2 w-24 rounded-pill bg-[#27272A] overflow-hidden flex">
                        <div
                          className={`h-full rounded-pill ${
                            score != null && score >= 4 ? "escalation-high" : score != null && score >= 3 ? "escalation-moderate" : "escalation-low"
                          }`}
                          style={{ width: score != null ? `${(score / 5) * 100}%` : "0%" }}
                        />
                      </div>
                      <span
                        className={`rounded-badge px-3 py-0.5 text-meta font-medium ${
                          score != null && score >= 4 ? "signal-negative" : score != null && score >= 3 ? "bg-[rgba(251,191,36,0.1)] text-[#FBBF24]" : "signal-neutral"
                        }`}
                      >
                        {escalationLabel(score)}
                      </span>
                    </div>
                    {trends.length > 0 && (
                      <ul className="list-inside list-disc space-y-1 text-body text-[#A1A1AA]">
                        {trends.slice(0, 3).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/weekly/${s.id}`}
                        className="inline-flex w-fit rounded-badge border border-[#27272A] bg-[#18181B] px-4 py-2 text-body font-medium text-foreground hover:bg-[#27272A] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150"
                      >
                        View Full Brief
                      </Link>
                      <RemoveBriefButton id={s.id} />
                    </div>
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
