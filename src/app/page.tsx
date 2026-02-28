import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold tracking-tight">SignalDesk</h1>
      <p className="mt-2 text-muted-foreground text-center max-w-md">
        AI-powered financial & political intelligence platform.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Dashboard
        </Link>
        <a
          href="/api/articles"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          API: Articles
        </a>
      </div>
    </div>
  );
}
