/** Taxonomy for article categories (AI picks 1–3 per article). */
export const ARTICLE_CATEGORIES = [
  "Finance",
  "Crypto",
  "Political",
  "Geopolitics",
  "War & Conflict",
  "Technology",
  "Regulation",
  "Markets",
  "Energy",
  "Healthcare",
  "Other",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

/** Color-coded tag styles per category (bg, text, border). */
const CATEGORY_TAG_STYLES: Record<string, string> = {
  Finance: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40",
  Crypto: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40",
  Political: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/40",
  Geopolitics: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-400/40",
  "War & Conflict": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40",
  Technology: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/40",
  Regulation: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/40",
  Markets: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-400/40",
  Energy: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/40",
  Healthcare: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-400/40",
  Other: "bg-muted text-muted-foreground border-border",
};

export function getCategoryTagClass(category: string): string {
  const base = "rounded-md border px-2 py-0.5 text-xs font-medium";
  const style = CATEGORY_TAG_STYLES[category] ?? CATEGORY_TAG_STYLES.Other;
  return `${base} ${style}`;
}
