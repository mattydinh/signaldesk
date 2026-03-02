import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ZScoresPage() {
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

      <article className="space-y-8 rounded-card border border-[#27272A] bg-[#18181B]/40 p-8" aria-labelledby="z-scores-heading">
        <h1 id="z-scores-heading" className="text-page-title text-foreground">
          How I use z-scores (and what they actually mean)
        </h1>

        <p className="text-body text-[#A1A1AA]">
          When I show a z-score in SignalDesk, I&apos;m not saying &quot;the market is going up&quot; or &quot;the market is going down.&quot;
        </p>

        <p className="text-body text-[#A1A1AA]">
          I&apos;m measuring something different:
        </p>

        <p className="text-body text-[#A1A1AA]">
          I&apos;m measuring how unusual today is compared to recent history.
        </p>

        <p className="text-body text-[#A1A1AA]">
          A z-score simply tells me how extreme something is relative to its own normal behavior. It doesn&apos;t predict direction by itself. It tells me whether sentiment, volume, or attention is behaving in a way that&apos;s statistically unusual.
        </p>

        <p className="text-body text-[#A1A1AA]">
          When a sentiment z-score is:
        </p>

        <ul className="list-inside list-disc space-y-2 text-body text-[#A1A1AA]">
          <li><strong className="text-foreground">0</strong> → Sentiment is normal.</li>
          <li><strong className="text-foreground">+1</strong> → Somewhat more positive than usual.</li>
          <li><strong className="text-foreground">+2 or +3</strong> → Extremely more positive than usual.</li>
          <li><strong className="text-foreground">-2 or -3</strong> → Extremely more negative than usual.</li>
        </ul>

        <p className="text-body text-[#A1A1AA]">
          So if Finance Sentiment has a z-score of -3, that doesn&apos;t automatically mean &quot;bear market.&quot; It means finance news is far more negative than it typically is. It&apos;s an extreme reading — a rare moment.
        </p>

        <p className="text-body text-[#A1A1AA]">
          What I&apos;ve learned is that markets are reactive systems. By the time sentiment reaches an extreme, price has often already moved significantly. That&apos;s why very high positive z-scores can appear near market peaks, and very negative z-scores can appear near panic lows.
        </p>

        <p className="text-body text-[#A1A1AA]">
          In other words:
        </p>

        <ul className="list-inside list-disc space-y-2 text-body text-[#A1A1AA]">
          <li>A high z-score doesn&apos;t mean &quot;bull market.&quot;</li>
          <li>A low z-score doesn&apos;t mean &quot;bear market.&quot;</li>
        </ul>

        <p className="text-body text-[#A1A1AA]">
          It means the emotional tone of the market narrative is stretched.
        </p>

        <p className="text-body text-[#A1A1AA]">
          Sometimes extremes continue.<br />
          Sometimes they reverse.
        </p>

        <p className="text-body text-[#A1A1AA]">
          That&apos;s why I don&apos;t treat sentiment as a directional command. I treat it as a pressure gauge.
        </p>

        <p className="text-body text-[#A1A1AA]">
          Z-scores help me understand when the environment is calm versus when it&apos;s statistically abnormal. They measure intensity, not destiny.
        </p>

        <p className="text-body text-[#A1A1AA]">
          Markets don&apos;t move just because sentiment is high or low. They move because expectations change. And extreme sentiment readings often signal that expectations are already heavily skewed in one direction.
        </p>

        <p className="text-body text-[#A1A1AA]">
          That&apos;s the difference.
        </p>

        <p className="text-body text-[#A1A1AA]">
          I&apos;m not using z-scores to label markets.
        </p>

        <p className="text-body text-[#A1A1AA]">
          I&apos;m using them to measure when the narrative itself is unusually strong — and that context is often more powerful than the label.
        </p>
      </article>
    </main>
  );
}
