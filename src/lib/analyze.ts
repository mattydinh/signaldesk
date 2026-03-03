/**
 * Core article analysis logic — shared by the API route and cron jobs.
 * Calls Groq (free tier) or OpenAI to generate investor-facing intelligence.
 */
import { prisma } from "@/lib/db";
import { hasSupabaseDb } from "@/lib/supabase-server";
import { getArticleByIdSupabase, updateArticleAnalysisSupabase } from "@/lib/data-supabase";
import { syncEventCategoriesFromArticle } from "@/lib/events";
import { ARTICLE_CATEGORIES } from "@/lib/categories";

const CATEGORY_LIST = ARTICLE_CATEGORIES.join(", ");

const SYSTEM_PROMPT = `You are an analyst for a financial and political intelligence platform. Given news article text, respond with a JSON object only (no markdown, no code block) with exactly these keys:

- "entities": array of 3-8 notable entities (people, companies, countries, agencies) mentioned.
- "topics": array of 2-5 topics or themes (e.g. "monetary policy", "elections", "energy", "tax policy").
- "categories": array of 1-3 categories from this exact list (use these strings only): ${CATEGORY_LIST}. Pick the most relevant; use "Other" only if none fit. Do not use "War & Conflict" for entertainment, games, or media (e.g. the video game "God of War", TV/film). Use "Entertainment" or "Other" for those. Examples: finance + elections → ["Finance", "Political"]; bitcoin regulation → ["Crypto", "Regulation"]; military conflict → ["War & Conflict", "Geopolitics"].
- "implications": one to two sentences: a clear AI-generated summary of what the article is about and why it matters for decision-makers. If the piece is about policy, law, or regulation, briefly state what is changing and who it affects.
- "opportunities": array of 2-5 concrete opportunities or recommendations (e.g. "Consider overweight sectors benefiting from rate cuts", "Watch for policy clarity in Q2"). Be specific and actionable.
- "forShareholders": 1-3 sentences on what this news means for equity holders: valuation, dividends, sector rotation, company-specific risks. For political or regulatory news, call out how a law or policy change could affect specific industries or sectors (e.g. "A tariff on X could pressure margins in industry Y").
- "forInvestors": 1-3 sentences on what this means for investors: market direction, sectors to watch, risk factors, timing. If the story is about legislation or regulation, spell out which industries stand to gain or lose and how.
- "forBusiness": 1-3 sentences on what this means for business leaders: strategy, supply chain, regulation, competitive dynamics. For policy/law news, explain how the change might affect operations, compliance, or industry structure (e.g. "New rules on Z could raise costs for manufacturers and favor domestic suppliers").

Be concise, factual, and directly useful. When the article is political or regulatory, always make the link from law/policy change to industry and business impact explicit.`;

type AnalysisConfig = { url: string; apiKey: string; model: string; provider: string };

/** Use Groq (free tier) if set; otherwise OpenAI. */
export function getAnalyzeConfig(): AnalysisConfig | null {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: "llama-3.1-8b-instant",
      provider: "Groq",
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: "gpt-4o-mini",
      provider: "OpenAI",
    };
  }
  return null;
}

export type AnalyzeResult = { ok: true; id: string } | { ok: false; error: string };

type AnalysisFields = {
  entities: string[];
  topics: string[];
  categories: string[];
  implications: string | null;
  opportunities: string[];
  forShareholders: string | null;
  forInvestors: string | null;
  forBusiness: string | null;
};

async function fetchArticleText(id: string): Promise<string | null> {
  let article: { title: string; summary: string | null } | null = null;
  if (hasSupabaseDb()) {
    article = await getArticleByIdSupabase(id);
  } else {
    article = await prisma.article.findUnique({
      where: { id },
      include: { source: true },
    });
  }
  if (!article) return null;
  return [article.title, article.summary].filter(Boolean).join("\n") || null;
}

async function callAnalysisProvider(config: AnalysisConfig, articleText: string): Promise<AnalyzeResult | AnalysisFields> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this article:\n\n${articleText.slice(0, 6000)}` },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" as const },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[analyze]", config.provider, "error", res.status, errorBody);
    return { ok: false, error: parseProviderError(errorBody) };
  }

  const data = (await res.json()) as { choices: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    return { ok: false, error: "No analysis in response." };
  }

  return parseAnalysisResponse(raw);
}

function parseProviderError(errorBody: string): string {
  try {
    const parsed = JSON.parse(errorBody) as { error?: { message?: string; code?: string } };
    if (parsed.error?.code === "insufficient_quota") return "API quota exceeded. Try again later.";
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // fall through
  }
  return "Analysis request failed.";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value : [];
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function parseAnalysisResponse(raw: string): AnalysisFields {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawCategories = toStringArray(parsed.categories);
  return {
    entities: toStringArray(parsed.entities),
    topics: toStringArray(parsed.topics),
    categories: rawCategories.filter(
      (c) => typeof c === "string" && ARTICLE_CATEGORIES.includes(c as (typeof ARTICLE_CATEGORIES)[number])
    ),
    implications: toTrimmedString(parsed.implications),
    opportunities: toStringArray(parsed.opportunities),
    forShareholders: toTrimmedString(parsed.forShareholders),
    forInvestors: toTrimmedString(parsed.forInvestors),
    forBusiness: toTrimmedString(parsed.forBusiness),
  };
}

async function saveAnalysis(id: string, fields: AnalysisFields): Promise<void> {
  if (hasSupabaseDb()) {
    await updateArticleAnalysisSupabase(id, fields);
  } else {
    await prisma.article.update({ where: { id }, data: fields });
  }
  await syncEventCategoriesFromArticle(id, fields.categories);
}

/**
 * Analyze a single article by ID.
 * Fetches the article, calls Groq/OpenAI, saves results to DB, syncs event categories.
 */
export async function analyzeArticle(id: string): Promise<AnalyzeResult> {
  const config = getAnalyzeConfig();
  if (!config) return { ok: false, error: "No analysis API key set." };

  try {
    const articleText = await fetchArticleText(id);
    if (!articleText) return { ok: false, error: "Article not found or has no text." };

    const result = await callAnalysisProvider(config, articleText);
    if ("ok" in result) return result;

    await saveAnalysis(id, result);
    return { ok: true, id };
  } catch (e) {
    console.error("[analyze]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Analysis failed." };
  }
}
