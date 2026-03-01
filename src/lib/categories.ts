/** Taxonomy for article categories (AI picks 1–3 per article). */
export const ARTICLE_CATEGORIES = [
  "Finance",
  "Crypto",
  "Political",
  "Geopolitics",
  "War & Conflict",
  "Technology",
  "Entertainment",
  "Regulation",
  "Markets",
  "Energy",
  "Healthcare",
  "Other",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

/** Inline styles per category so colors always apply (avoids Tailwind purging dynamic classes). */
export type CategoryTagStyle = { backgroundColor: string; color: string; borderColor: string };

const CATEGORY_TAG_STYLES: Record<string, CategoryTagStyle> = {
  Markets: { backgroundColor: "rgba(99, 102, 241, 0.35)", color: "#a5b4fc", borderColor: "rgba(129, 140, 248, 0.6)" },
  Finance: { backgroundColor: "rgba(16, 185, 129, 0.35)", color: "#6ee7b7", borderColor: "rgba(52, 211, 153, 0.6)" },
  Technology: { backgroundColor: "rgba(14, 165, 233, 0.35)", color: "#7dd3fc", borderColor: "rgba(56, 189, 248, 0.6)" },
  Entertainment: { backgroundColor: "rgba(192, 132, 252, 0.35)", color: "#e9d5ff", borderColor: "rgba(216, 180, 254, 0.6)" },
  Crypto: { backgroundColor: "rgba(245, 158, 11, 0.35)", color: "#fcd34d", borderColor: "rgba(251, 191, 36, 0.6)" },
  Political: { backgroundColor: "rgba(59, 130, 246, 0.35)", color: "#93c5fd", borderColor: "rgba(96, 165, 250, 0.6)" },
  Geopolitics: { backgroundColor: "rgba(139, 92, 246, 0.35)", color: "#c4b5fd", borderColor: "rgba(167, 139, 250, 0.6)" },
  "War & Conflict": { backgroundColor: "rgba(244, 63, 94, 0.35)", color: "#fda4af", borderColor: "rgba(251, 113, 133, 0.6)" },
  Regulation: { backgroundColor: "rgba(100, 116, 139, 0.3)", color: "#cbd5e1", borderColor: "rgba(148, 163, 184, 0.5)" },
  Energy: { backgroundColor: "rgba(249, 115, 22, 0.35)", color: "#fdba74", borderColor: "rgba(251, 146, 60, 0.6)" },
  Healthcare: { backgroundColor: "rgba(20, 184, 166, 0.35)", color: "#5eead4", borderColor: "rgba(45, 212, 191, 0.6)" },
  Other: { backgroundColor: "rgba(113, 113, 122, 0.25)", color: "#a1a1aa", borderColor: "rgba(161, 161, 170, 0.5)" },
};

export function getCategoryTagStyle(category: string): CategoryTagStyle {
  return CATEGORY_TAG_STYLES[category] ?? CATEGORY_TAG_STYLES.Other;
}

/** Keyword rules to infer 1–3 categories when AI analysis hasn't run. Order matters (first match wins for tie-break). */
const CATEGORY_KEYWORDS: { category: string; keywords: RegExp }[] = [
  { category: "Crypto", keywords: /crypto|bitcoin|ethereum|blockchain|defi|token|nft|coinbase|binance/i },
  { category: "Entertainment", keywords: /video game|gaming|god of war|playstation|xbox|nintendo|entertainment|film|movie|tv series|first look|streaming/i },
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

/** Text that indicates entertainment/gaming context; do not tag these as War & Conflict. */
const ENTERTAINMENT_CONTEXT = /god of war|video game|gaming|playstation|xbox|nintendo|entertainment|tv series|film|movie|first look|streaming/i;

/**
 * Infer 1–3 categories from title and summary when the article has no AI-assigned categories.
 * Uses keyword matching so tags always show even before analyze runs.
 * Removes "War & Conflict" when text indicates entertainment/gaming (e.g. "God of War" the game).
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
  if (matched.includes("War & Conflict") && ENTERTAINMENT_CONTEXT.test(text)) {
    const without = matched.filter((c) => c !== "War & Conflict");
    if (!without.includes("Entertainment")) without.push("Entertainment");
    return without.length > 0 ? without : ["Other"];
  }
  return matched.length > 0 ? matched : ["Other"];
}
