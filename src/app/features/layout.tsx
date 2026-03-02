import Link from "next/link";

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
              className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors"
            >
              Intelligence
            </Link>
            <Link
              href="/features"
              className="text-body text-[#FAFAFA] focus-visible:underline"
              aria-current="page"
            >
              Features (beta)
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
      {children}
    </div>
  );
}
