/**
 * Weekly Intelligence Summary — fetch last 7 days of articles, filter by theme,
 * generate structured AI summary, upsert to DB. For finance/data-science readers who invest.
 */
import { prisma } from "@/lib/db";
import { getArticlesSupabase } from "@/lib/data-supabase";
import { hasSupabaseDb } from "@/lib/supabase-server";

const THEME_KEYWORDS = [
  "china", "ccp", "beijing", "taiwan", "south china sea", "semiconductor export",
  "military", "conflict", "sanctions", "defense spending", "nato", "weapons transfer",
  "regulation", "sec", "policy change", "interest rate", "real estate", "refinancing",
  "commercial property",
];

const MAX_ARTICLES_FOR_PROMPT = 80;
const MAX_CHARS_FOR_PROMPT = 95_000;

/**
 * Returns the Sunday 00:00 UTC that started the week that just ended (past week).
 * We only generate briefs for the past week so we never create a partial-week summary.
 */
export function getPastWeekStart(now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const day = now.getUTCDay();
  const currentWeekStart = new Date(Date.UTC(y, m, d - day, 0, 0, 0, 0));
  const pastWeekStart = new Date(currentWeekStart);
  pastWeekStart.setUTCDate(pastWeekStart.getUTCDate() - 7);
  return pastWeekStart;
}

type ArticleSnippet = {
  title: string;
  summary: string | null;
  implications: string | null;
  opportunities: string[];
  forInvestors: string | null;
  forShareholders: string | null;
  forBusiness: string | null;
};

function getSearchableText(a: ArticleSnippet): string {
  const parts = [
    a.title,
    a.summary,
    a.implications,
    ...(a.opportunities ?? []),
    a.forInvestors,
    a.forShareholders,
    a.forBusiness,
  ].filter(Boolean);
  return parts.join(" ").toLowerCase();
}

function matchesTheme(a: ArticleSnippet): boolean {
  const text = getSearchableText(a);
  return THEME_KEYWORDS.some((kw) => text.includes(kw));
}

/** Fetch articles in [weekStart, weekEnd]. Uses Supabase/Blob/KV data layer. */
export async function getArticlesForWeek(weekStart: Date, weekEnd: Date): Promise<ArticleSnippet[]> {
  if (!hasSupabaseDb()) return [];
  const { articles } = await getArticlesSupabase({
    limit: 200,
    offset: 0,
    retentionDays: 0,
    windowStart: weekStart.toISOString(),
    windowEnd: weekEnd.toISOString(),
  });
  return articles.map((a) => ({
    title: a.title ?? "",
    summary: a.summary ?? null,
    implications: (a as { implications?: string | null }).implications ?? null,
    opportunities: (a as { opportunities?: string[] }).opportunities ?? [],
    forInvestors: (a as { forInvestors?: string | null }).forInvestors ?? null,
    forShareholders: (a as { forShareholders?: string | null }).forShareholders ?? null,
    forBusiness: (a as { forBusiness?: string | null }).forBusiness ?? null,
  }));
}

/** Prefer theme-relevant articles; if none or very few, use full feed so we always have something to summarize. */
export function selectArticlesForSummary(articles: ArticleSnippet[]): ArticleSnippet[] {
  const themeRelevant = articles.filter(matchesTheme);
  if (themeRelevant.length >= 5) return themeRelevant;
  return articles;
}

function getWeeklySummaryConfig(): { url: string; apiKey: string; model: string } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
    };
  }
  return null;
}

const SYSTEM_PROMPT = `You are a geopolitical and macroeconomic intelligence analyst. Your readers are finance, data science, and engineering professionals who invest in businesses, stocks, and crypto. Provide relevant news and actionable investment advice only.

Focus on: China's global positioning, US military posture, regulatory shifts, real estate exposure, and sector-level investment implications. Do not speculate wildly. Base conclusions strictly on the provided articles.

If the week has little or no wartime or China-at-war news, say so explicitly at the start (e.g. "No significant wartime or China-at-war developments this week."), then still summarize what IS in the feed—markets, regulation, sectors, tech—with key trends and investor implications. Never return a blank or "no news"-only brief.

Respond with a single JSON object only (no markdown, no code block) with exactly these keys:
- "title": string, a short headline for the week (e.g. "Escalating US-China Tensions & Regulatory Pressure on Strategic Industries")
- "summaryText": string, 2-4 sentence executive summary
- "keyTrends": array of 3-6 strings (e.g. "Increased naval presence in South China Sea", "New semiconductor export restrictions")
- "geopoliticalAssessment": object with "escalationLevel" (number 1-5) and "narrativeShift" (string, e.g. "Gradual hardening stance")
- "sectorImpact": array of objects with "sector" (string), "direction" (string: "Positive" | "Negative" | "Neutral"), "reasoning" (string)
- "investorImplications": array of 3-6 strings (actionable takeaways, e.g. "Monitor defense contractors for sustained spending growth")`;

type ParsedSummary = {
  title: string;
  summaryText: string;
  keyTrends: string[];
  geopoliticalAssessment: { escalationLevel: number; narrativeShift: string };
  sectorImpact: Array<{ sector: string; direction: string; reasoning: string }>;
  investorImplications: string[];
};

function buildUserPrompt(articles: ArticleSnippet[]): string {
  const truncated = articles.slice(0, MAX_ARTICLES_FOR_PROMPT);
  const parts = truncated.map((a, i) => {
    const blurb = [a.title, a.summary, a.implications, a.forInvestors]
      .filter(Boolean)
      .join(" ");
    return `[${i + 1}] ${blurb.slice(0, 1200)}`;
  });
  let text = parts.join("\n\n");
  if (text.length > MAX_CHARS_FOR_PROMPT) text = text.slice(0, MAX_CHARS_FOR_PROMPT) + "\n\n[truncated]";
  return `Articles from the past week (use only these; base your summary strictly on this content):\n\n${text}`;
}

function parseStructuredOutput(raw: string): ParsedSummary | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title : "Weekly Intelligence Brief";
    const summaryText = typeof parsed.summaryText === "string" ? parsed.summaryText : "";
    const keyTrends = Array.isArray(parsed.keyTrends)
      ? (parsed.keyTrends as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 10)
      : [];
    const geo = parsed.geopoliticalAssessment as Record<string, unknown> | undefined;
    const escalationLevel =
      typeof geo?.escalationLevel === "number" && geo.escalationLevel >= 1 && geo.escalationLevel <= 5
        ? geo.escalationLevel
        : null;
    const narrativeShift = typeof geo?.narrativeShift === "string" ? geo.narrativeShift : "";
    const sectorImpact = Array.isArray(parsed.sectorImpact)
      ? (parsed.sectorImpact as Array<{ sector?: string; direction?: string; reasoning?: string }>)
          .filter((s) => s && typeof s.sector === "string")
          .map((s) => ({
            sector: String(s.sector),
            direction: typeof s.direction === "string" ? s.direction : "Neutral",
            reasoning: typeof s.reasoning === "string" ? s.reasoning : "",
          }))
          .slice(0, 15)
      : [];
    const investorImplications = Array.isArray(parsed.investorImplications)
      ? (parsed.investorImplications as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 10)
      : [];
    return {
      title,
      summaryText,
      keyTrends,
      geopoliticalAssessment: { escalationLevel: escalationLevel ?? 0, narrativeShift },
      sectorImpact,
      investorImplications,
    };
  } catch {
    return null;
  }
}

/** Generate and persist one weekly summary for the given week (Sunday 00:00 UTC). */
export async function generateWeeklySummary(weekStart: Date): Promise<{ id: string } | { error: string }> {
  const config = getWeeklySummaryConfig();
  if (!config) {
    return { error: "No GROQ_API_KEY or OPENAI_API_KEY set." };
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const articles = await getArticlesForWeek(weekStart, weekEnd);
  const toSummarize = selectArticlesForSummary(articles);

  const userContent = toSummarize.length > 0
    ? buildUserPrompt(toSummarize)
    : "No articles in the feed for this week. Produce a brief that states this and gives general investor guidance (markets, regulation, sectors to watch) without inventing news.";

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" as const },
  };

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("[weekly-summary] fetch error", e);
    return { error: e instanceof Error ? e.message : "Request failed." };
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("[weekly-summary] API error", res.status, err);
    return { error: `API ${res.status}: ${err.slice(0, 200)}` };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    return { error: "No content in API response." };
  }

  const parsed = parseStructuredOutput(raw);
  if (!parsed) {
    return { error: "Invalid JSON in summary response." };
  }

  const geopoliticalScore =
    parsed.geopoliticalAssessment.escalationLevel >= 1 && parsed.geopoliticalAssessment.escalationLevel <= 5
      ? parsed.geopoliticalAssessment.escalationLevel
      : null;

  const investorSignal = {
    geopoliticalAssessment: parsed.geopoliticalAssessment,
    investorImplications: parsed.investorImplications,
  };

  const summary = await prisma.weeklySummary.upsert({
    where: { weekStart },
    create: {
      weekStart,
      weekEnd,
      title: parsed.title,
      summaryText: parsed.summaryText,
      keyTrends: parsed.keyTrends,
      impactedSectors: parsed.sectorImpact,
      geopoliticalScore,
      investorSignal,
    },
    update: {
      weekEnd,
      title: parsed.title,
      summaryText: parsed.summaryText,
      keyTrends: parsed.keyTrends,
      impactedSectors: parsed.sectorImpact,
      geopoliticalScore,
      investorSignal,
    },
  });

  return { id: summary.id };
}
