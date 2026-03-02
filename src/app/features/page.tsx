import Link from "next/link";

export const dynamic = "force-dynamic";

export default function FeaturesPage() {
  return (
    <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
      <section className="mb-16" aria-labelledby="features-heading">
        <h1 id="features-heading" className="text-page-title text-foreground">
          Features (beta)
        </h1>
        <p className="mt-2 text-body text-[#A1A1AA] max-w-2xl">
          This is a page for beta testers to understand the ML pipeline that powers the app and here are some of my statistical reasonings.
        </p>
      </section>

      <nav
        className="grid gap-4 sm:grid-cols-2 max-w-2xl"
        aria-label="Feature documentation"
      >
        <Link
          href="/features/ml-pipeline"
          className="flex flex-col rounded-card border border-[#27272A] bg-[#18181B]/40 p-6 text-left transition-colors hover:border-[#3F3F46] hover:bg-[#18181B]/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
        >
          <h2 className="text-section-header text-foreground">
            ML pipeline & NLP
          </h2>
          <p className="mt-2 text-body text-[#A1A1AA]">
            How the Intelligence page turns articles into regime labels, derived signals, and backtests. Rule-based NLP and rolling statistics.
          </p>
        </Link>
        <Link
          href="/features/z-scores"
          className="flex flex-col rounded-card border border-[#27272A] bg-[#18181B]/40 p-6 text-left transition-colors hover:border-[#3F3F46] hover:bg-[#18181B]/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
        >
          <h2 className="text-section-header text-foreground">
            How I use z-scores
          </h2>
          <p className="mt-2 text-body text-[#A1A1AA]">
            What z-scores mean in SignalDesk: measuring how unusual today is compared to recent history, not predicting direction.
          </p>
        </Link>
      </nav>
    </main>
  );
}
