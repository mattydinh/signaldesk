import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-display-lg text-foreground sm:text-display-md md:text-display-lg tracking-tight">
          SignalDesk
        </h1>
        <p className="mt-6 text-body-lg text-muted-foreground max-w-xl mx-auto">
          AI-powered financial & political intelligence. Summaries and implications for shareholders, investors, and business leaders.
        </p>
        <div className="mt-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-btn gradient-primary px-8 py-3 text-body-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-opacity"
          >
            Open dashboard
          </Link>
        </div>
        <p className="mt-12 text-caption text-muted-foreground/80">
          Powered by News API · Groq · Supabase
        </p>
      </div>
    </div>
  );
}
