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

/** Color-coded tag styles per category (bg, text, border) — distinct, readable palette. */
const CATEGORY_TAG_STYLES: Record<string, string> = {
  Markets: "bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-indigo-400/50",
  Finance: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-400/50",
  Technology: "bg-sky-500/20 text-sky-800 dark:text-sky-200 border-sky-400/50",
  Crypto: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-400/50",
  Political: "bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-400/50",
  Geopolitics: "bg-violet-500/20 text-violet-800 dark:text-violet-200 border-violet-400/50",
  "War & Conflict": "bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-400/50",
  Regulation: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-400/50",
  Energy: "bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-400/50",
  Healthcare: "bg-teal-500/20 text-teal-800 dark:text-teal-200 border-teal-400/50",
  Other: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-400/40",
};

export function getCategoryTagClass(category: string): string {
  const base = "rounded-md border px-2 py-0.5 text-xs font-medium";
  const style = CATEGORY_TAG_STYLES[category] ?? CATEGORY_TAG_STYLES.Other;
  return `${base} ${style}`;
}

/** Keyword rules to infer 1–3 categories when AI analysis hasn't run. Order matters (first match wins for tie-break). */
const CATEGORY_KEYWORDS: { category: string; keywords: RegExp }[] = [
  { category: "Crypto", keywords: /crypto|bitcoin|ethereum|blockchain|defi|token|nft|coinbase|binance/i },
  { category: "War & Conflict", keywords: /war|military|conflict|invasion|strike|nato|weapon|troops/i },
  { category: "Regulation", keywords: /regulation|sec|fed\b|compliance|law\b|legislation|antitrust|doj|ftc/i },
  { category: "Markets", keywords: /market|stock|s&p|dow|nasdaq|trading|inflation|recession|rate cut|earnings|index/i },
  { category: "Finance", keywords: /bank|barclays|jpmorgan|goldman|morgan stanley|merger|acquisition|ipo|dividend|revenue|profit/i },
  { category: "Technology", keywords: /ai\b|artificial intelligence|nvidia|tech|software|apple|microsoft|google|amazon|chip|semiconductor/i },
  { category: "Energy", keywords: /oil|gas|energy|renewable|solar|wind|opec|ev\b|electric vehicle/i },
  { category: "Healthcare", keywords: /healthcare|pharma|drug|fda|vaccine|medical|biotech|hospital/i },
  { category: "Political", keywords: /election|trump|biden|congress|vote|senate|house|white house|political/i },
  { category: "Geopolitics", keywords: /china|russia|europe|sanction|trade war|tariff|foreign policy/i },
];

/**
 * Infer 1–3 categories from title and summary when the article has no AI-assigned categories.
 * Uses keyword matching so tags always show even before analyze runs.
 */
export function inferCategoriesFromText(
  title: string | null,
  summary: string | null
): string[] {
  const text = [title, summary].filter(Boolean).join(" ").toLowerCase();
  if (!text) return ["Other"];
  const matched: string[] = [];
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.test(text) && !matched.includes(category)) {
      matched.push(category);
      if (matched.length >= 3) break;
    }
  }
  return matched.length > 0 ? matched : ["Other"];
}
