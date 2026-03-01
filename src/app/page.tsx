import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-page-title text-foreground tracking-[-0.02em]">
          SignalDesk
        </h1>
        <p className="mt-6 text-body text-[#A1A1AA] max-w-xl mx-auto leading-relaxed">
          AI-powered financial & political intelligence. Summaries and implications for shareholders, investors, and business leaders.
        </p>
        <div className="mt-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-badge bg-primary px-8 py-3 text-body font-semibold text-primary-foreground hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-opacity duration-150"
          >
            Open dashboard
          </Link>
        </div>
        <p className="mt-12 text-meta text-[#71717A]">
          Powered by News API · Groq · Supabase
        </p>
      </div>
    </div>
  );
}
