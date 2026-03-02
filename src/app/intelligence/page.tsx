import Link from "next/link";
import { prisma } from "@/lib/db";
import SignalChart from "./SignalChart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getLatestRegime() {
  try {
    const latest = await prisma.regimeSnapshot.findFirst({
      orderBy: { date: "desc" },
    });
    return latest;
  } catch {
    return null;
  }
}

async function getRecentSignals(days = 90) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const signals = await prisma.derivedSignal.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
      take: 500,
    });
    return signals;
  } catch {
    return [];
  }
}

async function getLatestBacktestResults() {
  try {
    const results = await prisma.backtestResult.findMany({
      take: 10,
    });
    return results;
  } catch {
    return [];
  }
}

function regimeBadgeClass(regime: string): string {
  const r = regime.toLowerCase();
  if (r.includes("escalation") || r.includes("pressure")) return "bg-[rgba(248,113,113,0.15)] text-[#F87171] border-[#F87171]/40";
  if (r.includes("risk-off")) return "bg-[rgba(251,191,36,0.15)] text-[#FBBF24] border-[#FBBF24]/40";
  return "bg-[rgba(52,211,153,0.15)] text-[#34D399] border-[#34D399]/40";
}

export default async function IntelligencePage() {
  const [regime, signals, backtestResults] = await Promise.all([
    getLatestRegime(),
    getRecentSignals(),
    getLatestBacktestResults(),
  ]);

  const hasData = regime != null || signals.length > 0 || backtestResults.length > 0;

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
              className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
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
              className="text-body text-[#FAFAFA] focus-visible:underline"
              aria-current="page"
            >
              Intelligence
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
        <section className="mb-16" aria-labelledby="intelligence-heading">
          <h1 id="intelligence-heading" className="text-page-title text-foreground">
            Intelligence
          </h1>
          <p className="mt-2 text-body text-[#A1A1AA]">
            News-derived signals, regime classification, and backtested performance.
          </p>
        </section>

        {/* Regime Banner */}
        <section className="mb-16" aria-label="Current regime">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-4">Regime</h2>
            {regime ? (
              <div className="flex flex-wrap items-center gap-4">
                <span
                  className={`inline-flex items-center rounded-badge border px-4 py-2 text-body font-medium ${regimeBadgeClass(regime.regime)}`}
                >
                  {regime.regime}
                </span>
                <span className="text-body text-[#A1A1AA]">
                  Confidence: {Math.round(regime.confidence * 100)}%
                </span>
                {regime.drivers.length > 0 && (
                  <div className="w-full mt-2">
                    <p className="text-meta text-[#71717A] mb-1">Key drivers</p>
                    <ul className="list-inside list-disc text-body text-[#A1A1AA]">
                      {regime.drivers.slice(0, 3).map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-body text-[#71717A]">
                No regime data yet. Run the signals pipeline and regime job to populate.
              </p>
            )}
          </div>
        </section>

        {/* Signal Chart */}
        <section className="mb-16" aria-label="Core signals">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-4">Core Signals</h2>
            {signals.length > 0 ? (
              <SignalChart
                signals={signals.map((s) => ({
                  date: s.date.toISOString().slice(0, 10),
                  signalName: s.signalName,
                  zscore: s.zscore,
                }))}
              />
            ) : (
              <p className="text-body text-[#71717A]">
                No derived signals yet. Run the pipeline (GET /api/cron/run-pipeline) to populate.
              </p>
            )}
          </div>
        </section>

        {/* Signal Performance */}
        <section className="mb-16" aria-label="Signal performance">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-4">Signal Performance</h2>
            {backtestResults.length > 0 ? (
              <ul className="space-y-2 text-body text-[#A1A1AA]">
                {backtestResults.slice(0, 5).map((r, i) => (
                  <li key={i}>
                    {r.signalName} / {r.ticker}: Sharpe {r.sharpe.toFixed(2)}, Max DD {(r.maxDrawdown * 100).toFixed(1)}%
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-[#71717A]">
                No backtest results yet. Run the backtesting engine to populate.
              </p>
            )}
          </div>
        </section>

        {!hasData && (
          <p className="text-body text-[#71717A]">
            The ML pipeline is initializing. Once events, topic metrics, and signals are computed, this page will show regime, charts, and performance.
          </p>
        )}
      </main>
    </div>
  );
}
