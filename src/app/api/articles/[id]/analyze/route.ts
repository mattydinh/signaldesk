import { NextRequest, NextResponse } from "next/server";
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

/** Use Groq (free tier) if set; otherwise OpenAI. */
function getAnalyzeConfig(): { url: string; apiKey: string; model: string; provider: string } | null {
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

/**
 * POST /api/articles/[id]/analyze
 * Generates investor-facing implications using Groq (free tier) or OpenAI.
 * Set GROQ_API_KEY (recommended, free at console.groq.com) or OPENAI_API_KEY.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const config = getAnalyzeConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "No analysis API key set. Add GROQ_API_KEY (free at console.groq.com) or OPENAI_API_KEY in Vercel → Settings → Environment Variables.",
      },
      { status: 503 }
    );
  }

  const { id } = await params;
  let article: { title: string; summary: string | null; source: { name: string } } | null = null;
  if (hasSupabaseDb()) {
    article = await getArticleByIdSupabase(id);
  } else {
    article = await prisma.article.findUnique({
      where: { id },
      include: { source: true },
    });
  }
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  const text = [article.title, article.summary].filter(Boolean).join("\n");
  if (!text) {
    return NextResponse.json(
      { error: "Article has no title or summary to analyze." },
      { status: 400 }
    );
  }

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze this article:\n\n${text.slice(0, 6000)}` },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" as const },
  };

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[analyze]", config.provider, "error", res.status, err);
      let message = "Analysis request failed.";
      try {
        const parsed = JSON.parse(err) as { error?: { message?: string; code?: string } };
        if (parsed.error?.code === "insufficient_quota") {
          message =
            config.provider === "OpenAI"
              ? "OpenAI quota exceeded. Try adding GROQ_API_KEY (free) in Vercel instead."
              : "API quota exceeded. Try again later.";
        } else if (parsed.error?.message) {
          message = parsed.error.message;
        }
      } catch {
        // use default message
      }
      return NextResponse.json(
        { error: message, details: err },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { choices: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "No analysis in response." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw) as {
      entities?: string[];
      topics?: string[];
      categories?: string[];
      implications?: string;
      opportunities?: string[];
      forShareholders?: string;
      forInvestors?: string;
      forBusiness?: string;
    };

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    const rawCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
    const categories = rawCategories.filter((c) => typeof c === "string" && ARTICLE_CATEGORIES.includes(c as (typeof ARTICLE_CATEGORIES)[number]));
    const implications = typeof parsed.implications === "string" ? parsed.implications.trim() : null;
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const forShareholders = typeof parsed.forShareholders === "string" ? parsed.forShareholders.trim() : null;
    const forInvestors = typeof parsed.forInvestors === "string" ? parsed.forInvestors.trim() : null;
    const forBusiness = typeof parsed.forBusiness === "string" ? parsed.forBusiness.trim() : null;

    if (hasSupabaseDb()) {
      await updateArticleAnalysisSupabase(id, {
        entities,
        topics,
        categories,
        opportunities,
        implications,
        forShareholders,
        forInvestors,
        forBusiness,
      });
    } else {
      await prisma.article.update({
        where: { id },
        data: {
          entities,
          topics,
          categories,
          implications,
          opportunities,
          forShareholders,
          forInvestors,
          forBusiness,
        },
      });
    }
    await syncEventCategoriesFromArticle(id, categories);

    return NextResponse.json({
      ok: true,
      id,
      entities,
      topics,
      categories,
      implications,
      opportunities,
      forShareholders,
      forInvestors,
      forBusiness,
    });
  } catch (e) {
    console.error("[analyze]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
