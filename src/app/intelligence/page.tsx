import Link from "next/link";
import { prisma } from "@/lib/db";
import SignalChart from "./SignalChart";
import PopulateButton from "./PopulateButton";
import { runPipeline } from "@/lib/pipeline/run";
import { formatDbError } from "@/lib/format-db-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 90;

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

const REGIME_TOOLTIPS: Record<string, string> = {
  "Risk-On": "Investors are increasing exposure to equities and higher-risk assets.",
  "Risk-Off": "Investors are rotating into defensive assets (bonds, gold, cash).",
  Escalation: "Geopolitics and conflict dominate headlines; markets may price in higher uncertainty.",
  "Regulatory Pressure": "Regulation and policy are dominating the news; sector-specific risk may be elevated.",
};

function regimeBadgeClass(regime: string): string {
  const r = regime.toLowerCase();
  if (r.includes("escalation") || r.includes("pressure")) return "bg-[rgba(248,113,113,0.15)] text-[#F87171] border-[#F87171]/40";
  if (r.includes("risk-off")) return "bg-[rgba(251,191,36,0.15)] text-[#FBBF24] border-[#FBBF24]/40";
  return "bg-[rgba(52,211,153,0.15)] text-[#34D399] border-[#34D399]/40";
}

export default async function IntelligencePage() {
  let [regime, signals, backtestResults] = await Promise.all([
    getLatestRegime(),
    getRecentSignals(),
    getLatestBacktestResults(),
  ]);

  const hasData = regime != null || signals.length > 0 || backtestResults.length > 0;

  let pipelineError: string | null = null;
  // If no Intelligence data, run the pipeline once so the page can show results (e.g. after first deploy)
  if (!hasData) {
    try {
      await runPipeline();
      [regime, signals, backtestResults] = await Promise.all([
        getLatestRegime(),
        getRecentSignals(),
        getLatestBacktestResults(),
      ]);
    } catch (e) {
      console.error("[intelligence] pipeline run failed", e);
      const raw = e instanceof Error ? e.message : "Pipeline run failed (e.g. timeout)";
      pipelineError = formatDbError(raw);
    }
  }

  const hasDataNow = regime != null || signals.length > 0 || backtestResults.length > 0;

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

        {/* Read me — collapsible */}
        <section className="mb-16 rounded-card border border-[#27272A] bg-[#18181B]/40 p-6" aria-label="Read me">
          <details className="group">
            <summary className="text-section-header text-foreground cursor-pointer list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span>Read me</span>
              <span className="text-meta text-[#71717A] transition-transform group-open:rotate-90" aria-hidden>▶</span>
            </summary>
            <div className="space-y-6 text-body text-[#A1A1AA] mt-4 pt-4 border-t border-[#27272A]">
            <div>
              <h3 className="text-foreground font-medium mb-1">What the ML pipeline does</h3>
              <p className="mb-2">
                Every article we ingest becomes an <strong className="text-foreground">event</strong>. We run lightweight <strong className="text-foreground">NLP</strong> on each article’s text: we count positive vs negative words for <strong className="text-foreground">sentiment</strong>, and we score how much the text mentions regulation (e.g. SEC, Fed, court) and geopolitics (e.g. China, sanctions, elections) on a 0–1 scale. We then group articles by <strong className="text-foreground">topic</strong> (Markets, Finance, Technology, Geopolitics, Regulation, War & Conflict, etc.) and by <strong className="text-foreground">date</strong>, and for each topic each day we get: how many articles (volume) and the average sentiment. Finally we compare each topic’s daily value to its own last 60 days and express that as a <strong className="text-foreground">z-score</strong>—how many standard deviations above or below that topic’s recent norm. No external AI APIs: everything is rule-based keyword counts and rolling statistics.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">Regime</h3>
              <p>
                A single label for “what kind of environment are we in?” based on the latest signal z-scores. Risk-On means investors are willing to take risk; Risk-Off means they&apos;re fleeing to safety. Bad news sentiment (z &lt; -1) triggers Risk-Off. If <strong className="text-foreground">GeopoliticsVolume</strong> z &gt; 1.5 → <strong className="text-foreground">Escalation</strong>. Else if <strong className="text-foreground">RegulationVolume</strong> z &gt; 1.5 → <strong className="text-foreground">Regulatory Pressure</strong>. Else if average Markets/Finance sentiment z &lt; -1 → <strong className="text-foreground">Risk-Off</strong>. Otherwise → <strong className="text-foreground">Risk-On</strong>. <strong className="text-foreground">Confidence</strong> is how extreme the top driver is (0–100%). <strong className="text-foreground">Key drivers</strong> are the three signals with the largest absolute z-scores.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">Core Signals — what each one is</h3>
              <ul className="list-inside list-disc space-y-1 mb-3">
                <li><strong className="text-foreground">GeopoliticsVolume</strong> — Volume of Geopolitics-tagged articles vs its 60-day average (z-score).</li>
                <li><strong className="text-foreground">RegulationVolume</strong> — Volume of Regulation-tagged articles vs its 60-day average.</li>
                <li><strong className="text-foreground">MarketsSentiment</strong> — Average sentiment of Markets-tagged articles vs their 60-day average.</li>
                <li><strong className="text-foreground">FinanceSentiment</strong> — Average sentiment of Finance-tagged articles vs their 60-day average.</li>
                <li><strong className="text-foreground">TechnologyVolume</strong> — Volume of Technology-tagged articles vs its 60-day average.</li>
                <li><strong className="text-foreground">WarConflictVolume</strong> — Volume of War & Conflict–tagged articles vs its 60-day average.</li>
              </ul>
              <p className="mb-2">
                <strong className="text-foreground">How to read the z-score:</strong> z = (today’s value − 60-day mean) ÷ 60-day standard deviation. So <strong className="text-foreground">z = 0.71</strong> means “today is 0.71 standard deviations above this signal’s recent average”—i.e. moderately more than usual (e.g. for Technology Volume: more tech coverage than typical). <strong className="text-foreground">z &gt; 1</strong> = unusually high; <strong className="text-foreground">z &lt; -1</strong> = unusually low; <strong className="text-foreground">z between -1 and 1</strong> = in the normal range. The chart shows how that z-score has changed over time for the signal you select.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">Signal Performance</h3>
              <p>
                A <strong className="text-foreground">backtest</strong>: we simulate trading SPY (S&P 500) using only this signal—long when z &gt; 1, short when z &lt; -1, flat otherwise—over the last 90 days. <strong className="text-foreground">Sharpe</strong> = risk-adjusted return (higher is better). <strong className="text-foreground">Max DD</strong> = largest peak-to-trough drop (lower is better). For context only, not investment advice; results depend on having market price data in the pipeline.
              </p>
            </div>
            </div>
          </details>
        </section>

        {/* Regime Banner */}
        <section className="mb-16" aria-label="Current regime">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-1">Regime</h2>
            <p className="text-meta text-[#71717A] mb-4">
              Risk-On = investors adding risk; Risk-Off = investors reducing risk. Hover the badge for details.
            </p>
            {regime ? (
              <div className="flex flex-wrap items-center gap-4">
                <span
                  title={REGIME_TOOLTIPS[regime.regime] ?? ""}
                  className={`inline-flex cursor-help items-center rounded-badge border px-4 py-2 text-body font-medium ${regimeBadgeClass(regime.regime)}`}
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
                No regime data yet. Run the pipeline (button below) or fetch news first so events exist.
              </p>
            )}
          </div>
        </section>

        {/* Signal Chart */}
        <section className="mb-16" aria-label="Core signals">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-4">Core Signals</h2>
            <p className="text-meta text-[#71717A] mb-4">
              Pick a signal to see its z-score over time. <strong className="text-[#A1A1AA]">z &gt; 1</strong> = unusually high vs last 60 days; <strong className="text-[#A1A1AA]">z &lt; -1</strong> = unusually low; <strong className="text-[#A1A1AA]">-1 to 1</strong> = normal range. Example: Technology Volume z = 0.71 means tech news volume is moderately above its recent average.
            </p>
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
                No derived signals yet. Signals come from ingested articles (events). Use Dashboard → Fetch news, then run the pipeline.
              </p>
            )}
          </div>
        </section>

        {/* Signal Performance */}
        <section className="mb-16" aria-label="Signal performance">
          <div className="glass-card rounded-card border border-[#27272A] p-8">
            <h2 className="text-section-header text-foreground mb-1">Signal Performance</h2>
            <p className="text-meta text-[#71717A] mb-4">
              Simulated SPY strategy from this signal over the last 90 days (long when z &gt; 1, short when z &lt; -1). <strong className="text-[#A1A1AA]">Sharpe</strong> = risk-adjusted return; <strong className="text-[#A1A1AA]">Max DD</strong> = largest peak-to-trough drop. Not investment advice.
            </p>
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

        {!hasDataNow && (
          <div className="space-y-4 rounded-card border border-[#27272A] bg-[#18181B]/60 p-6">
            <p className="text-body text-[#A1A1AA]">
              Intelligence data comes from the ML pipeline (events → signals → regime → backtest). That pipeline runs automatically after you <Link href="/dashboard" className="text-[#FAFAFA] underline">fetch news</Link> or on a schedule; the first run can take up to a minute and may timeout on Vercel.
            </p>
            {pipelineError && (
              <p className="text-body text-[#F87171]">
                First-load run failed: {pipelineError}. Use the button below or run the pipeline from your dashboard / cron.
              </p>
            )}
            <PopulateButton />
          </div>
        )}
      </main>
    </div>
  );
}
