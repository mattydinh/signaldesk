import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          SignalDesk
        </h1>
        <p className="mt-4 text-lg text-muted-foreground sm:text-xl max-w-xl mx-auto">
          AI-powered financial & political intelligence. Summaries and implications for shareholders, investors, and business leaders.
        </p>
        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 transition-opacity"
          >
            Open dashboard
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          News API · Groq AI summaries · Supabase
        </p>
      </div>
    </div>
  );
}
