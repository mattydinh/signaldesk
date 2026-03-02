/**
 * Tag audit: list recent articles with AI-assigned categories, source, and date
 * for spot-check before using tags in trading-signal experiments.
 */
import Link from "next/link";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticlesSupabase } from "@/lib/data-supabase";
import { getCategoryTagStyle } from "@/lib/categories";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getRecentArticlesWithCategories(): Promise<
  { id: string; title: string | null; publishedAt: Date | null; categories: string[]; sourceName?: string }[]
> {
  const retentionDays =
    typeof process.env.ARTICLE_RETENTION_DAYS !== "undefined"
      ? parseInt(process.env.ARTICLE_RETENTION_DAYS, 10)
      : 30;
  const days = Number.isNaN(retentionDays) ? 30 : retentionDays;
  const since = new Date();
  since.setDate(since.getDate() - days);

  if (hasSupabaseDb()) {
    const { articles } = await getArticlesSupabase({
      limit: 100,
      offset: 0,
      retentionDays: days,
    });
    return articles as { id: string; title: string | null; publishedAt: string | null; categories: string[]; sourceName?: string }[];
  }
  const rows = await prisma.article.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: { id: true, title: true, publishedAt: true, categories: true, source: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    publishedAt: r.publishedAt,
    categories: r.categories,
    sourceName: r.source.name,
  }));
}

export default async function AuditTagsPage() {
  const articles = await getRecentArticlesWithCategories();

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-10 glass h-16">
        <div className="mx-auto flex h-full max-w-feed items-center justify-between px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-8" aria-label="Main">
            <Link href="/" className="text-body font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-btn">
              SignalDesk
            </Link>
            <Link href="/dashboard" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Dashboard
            </Link>
            <Link href="/weekly" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Weekly
            </Link>
            <Link href="/intelligence" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Intelligence
            </Link>
            <Link href="/features" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline transition-colors">
              Features (beta)
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-feed px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="text-body text-[#A1A1AA] hover:text-[#FAFAFA] focus-visible:underline mb-8 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-page-title text-foreground">Tag audit</h1>
        <p className="mt-2 text-body text-[#A1A1AA] max-w-2xl">
          Recent articles with AI-assigned categories. Use this to spot-check tagging before relying on it for trading-signal experiments. Only vetted ingestion should drive signals.
        </p>

        {articles.length === 0 ? (
          <p className="mt-8 text-body text-[#71717A]">
            No articles in Supabase, or Supabase not configured. Fetch news from the Dashboard first.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-card border border-[#27272A]">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#18181B]/40">
                  <th className="px-4 py-3 text-left font-medium text-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">AI categories</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const categories = a.categories ?? [];
                  const sourceName = a.sourceName ?? "—";
                  const publishedAt = a.publishedAt instanceof Date ? a.publishedAt : a.publishedAt ? new Date(a.publishedAt) : null;
                  const dateStr = publishedAt
                    ? publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—";
                  return (
                    <tr key={a.id} className="border-b border-[#27272A]/60">
                      <td className="px-4 py-3 text-[#A1A1AA] whitespace-nowrap">{dateStr}</td>
                      <td className="px-4 py-3 text-[#A1A1AA]">{sourceName}</td>
                      <td className="px-4 py-3 text-foreground max-w-md truncate" title={a.title ?? ""}>
                        {a.title ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {categories.length > 0 ? (
                            categories.map((c) => {
                              const style = getCategoryTagStyle(c);
                              return (
                                <span
                                  key={c}
                                  className="rounded-badge border px-2 py-0.5 text-meta font-medium"
                                  style={{
                                    backgroundColor: style.backgroundColor,
                                    color: style.color,
                                    borderColor: style.borderColor,
                                  }}
                                >
                                  {c}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-meta text-[#71717A]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
