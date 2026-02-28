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

/** Color-coded tag styles — high contrast in dark mode so tags pop. */
const CATEGORY_TAG_STYLES: Record<string, string> = {
  Markets: "bg-indigo-500/30 text-indigo-300 border-indigo-400/60",
  Finance: "bg-emerald-500/30 text-emerald-300 border-emerald-400/60",
  Technology: "bg-sky-500/30 text-sky-300 border-sky-400/60",
  Crypto: "bg-amber-500/30 text-amber-300 border-amber-400/60",
  Political: "bg-blue-500/30 text-blue-300 border-blue-400/60",
  Geopolitics: "bg-violet-500/30 text-violet-300 border-violet-400/60",
  "War & Conflict": "bg-rose-500/30 text-rose-300 border-rose-400/60",
  Regulation: "bg-slate-500/25 text-slate-300 border-slate-400/50",
  Energy: "bg-orange-500/30 text-orange-300 border-orange-400/60",
  Healthcare: "bg-teal-500/30 text-teal-300 border-teal-400/60",
  Other: "bg-zinc-500/25 text-zinc-400 border-zinc-400/50",
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
