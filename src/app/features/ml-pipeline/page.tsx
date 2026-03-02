import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MLPipelinePage() {
  return (
    <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
      <p className="mb-8">
        <Link
          href="/features"
          className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
        >
          ← Features (beta)
        </Link>
      </p>

      <section className="space-y-8 rounded-card border border-[#27272A] bg-[#18181B]/40 p-8" aria-labelledby="ml-pipeline-heading">
        <h1 id="ml-pipeline-heading" className="text-page-title text-foreground">
          ML pipeline & NLP (Intelligence page)
        </h1>
        <p className="text-body text-[#A1A1AA]">
          The <Link href="/intelligence" className="text-[#FAFAFA] underline">Intelligence</Link> page is powered by an in-app ML pipeline that turns ingested articles into regime labels, derived signals, and backtested performance. No external AI APIs are used for this pipeline—only rule-based NLP and rolling statistics.
        </p>

        <div>
          <h2 className="text-foreground font-medium mb-2">What kind of NLP it is</h2>
          <ul className="list-inside list-disc space-y-2 text-body text-[#A1A1AA]">
            <li>
              <strong className="text-foreground">Lexicon-based sentiment</strong> — Each article&apos;s text (title + body) is scored with simple positive/negative keyword counts (e.g. &quot;growth&quot;, &quot;recession&quot;, &quot;tariff&quot;). The score is normalized to a -1 to +1 range. No embeddings or language models.
            </li>
            <li>
              <strong className="text-foreground">Theme scoring</strong> — Two theme scores (0–1) are computed per article: <strong className="text-foreground">regulation</strong> (e.g. SEC, Fed, court, antitrust) and <strong className="text-foreground">geopolitical</strong> (e.g. China, sanctions, military, elections). Each is a keyword-count cap so we measure &quot;how much this article is about&quot; each theme.
            </li>
            <li>
              <strong className="text-foreground">Topic aggregation</strong> — Articles are tagged with categories (Markets, Finance, Technology, Geopolitics, Regulation, War & Conflict, etc.) from AI analysis when available, or from the same keyword rules used elsewhere. We then aggregate by <strong className="text-foreground">topic + date</strong>: article count, average sentiment, and a <strong className="text-foreground">volume z-score</strong> (today&apos;s count vs the last 60 days for that topic). So we get a time series per topic on a comparable scale.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-2">Pipeline steps (high level)</h2>
          <ol className="list-decimal list-inside space-y-2 text-body text-[#A1A1AA]">
            <li><strong className="text-foreground">Events</strong> — Each ingested article becomes an Event.</li>
            <li><strong className="text-foreground">Event features</strong> — Sentiment + regulation + geopolitical scores per event (rule-based, no API).</li>
            <li><strong className="text-foreground">Daily topic metrics</strong> — Per topic per day: article count, average sentiment, volume z-score (vs 60-day rolling).</li>
            <li><strong className="text-foreground">Derived signals</strong> — Six signals: e.g. Geopolitics Volume, Regulation Volume, Markets Sentiment, Finance Sentiment, Technology Volume, War & Conflict Volume. Each is either a volume z-score or an average sentiment for that topic; we then z-score the signal again over a 60-day window and clip to ±3 so extremes are comparable.</li>
            <li><strong className="text-foreground">Regime</strong> — One label per day from the latest signal z-scores: e.g. Geopolitics z &gt; 1.5 → &quot;Escalation&quot;; Regulation z &gt; 1.5 → &quot;Regulatory Pressure&quot;; (Markets + Finance sentiment z) &lt; -1 → &quot;Risk-Off&quot;; else &quot;Risk-On&quot;. Confidence and &quot;key drivers&quot; come from the largest absolute z-scores.</li>
            <li><strong className="text-foreground">Backtest</strong> — For each signal we simulate a strategy on SPY: long when z &gt; 1, short when z &lt; -1, flat otherwise. We store Sharpe and max drawdown for the Intelligence page.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-2">Why features can have statistical significance together</h2>
          <ul className="list-inside list-disc space-y-2 text-body text-[#A1A1AA]">
            <li><strong className="text-foreground">Same scale</strong> — Everything is expressed as z-scores or normalized scores, so &quot;unusual&quot; is defined relative to each series&apos; own recent history. That makes it meaningful to combine signals (e.g. &quot;geopolitics hot and markets sentiment cold&quot;).</li>
            <li><strong className="text-foreground">Regime as a simple combination rule</strong> — Regime doesn&apos;t use a single signal; it uses a small, fixed rule set over several z-scores (geopolitics, regulation, markets/finance sentiment). So the <em>joint</em> behavior of those features drives the label. That&apos;s a minimal form of multi-feature structure: thresholds and a priority order instead of a black box.</li>
            <li><strong className="text-foreground">Economically motivated</strong> — Volume spikes in Geopolitics or Regulation often coincide with policy or uncertainty; sentiment in Markets/Finance is a crude fear/greed proxy. Aggregating by topic and normalizing by time makes it plausible that these features carry information that can be combined in a stable way.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-foreground font-medium mb-2">Why the signals could do well logically</h2>
          <ul className="list-inside list-disc space-y-2 text-body text-[#A1A1AA]">
            <li><strong className="text-foreground">Interpretable</strong> — Each signal is &quot;how unusual is this topic&apos;s volume or sentiment today?&quot; so you can tie backtest and regime to specific news themes.</li>
            <li><strong className="text-foreground">Backtest design</strong> — We only take a view when the signal is clearly extreme (|z| &gt; 1), which reduces noise and keeps the strategy rule simple. We&apos;re not claiming causal proof—only that the pipeline is coherent and the signals are economically sensible.</li>
            <li><strong className="text-foreground">Caveat</strong> — Results depend on data quality (ingest, categories, market prices). The pipeline is best used as one input among others, not as standalone investment advice.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
