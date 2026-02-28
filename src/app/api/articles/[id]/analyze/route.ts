import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/articles/[id]/analyze
 * Extracts entities/topics and generates investor-facing implications using OpenAI.
 * Requires OPENAI_API_KEY in .env.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: { source: true },
  });
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

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an analyst for a financial and political intelligence platform. Given news article text, respond with a JSON object only (no markdown, no code block) with exactly these keys:

- "entities": array of 3-8 notable entities (people, companies, countries, agencies) mentioned.
- "topics": array of 2-5 topics or themes (e.g. "monetary policy", "elections", "energy").
- "implications": one short sentence summarizing the main takeaway for decision-makers.
- "opportunities": array of 2-5 concrete opportunities or recommendations (e.g. "Consider overweight sectors benefiting from rate cuts", "Watch for policy clarity in Q2"). Be specific and actionable.
- "forShareholders": 1-3 sentences on what this news means for equity holders: valuation, dividends, sector rotation, or company-specific risks.
- "forInvestors": 1-3 sentences on what this means for investors in the space: market direction, sectors to watch, risk factors, or timing.
- "forBusiness": 1-3 sentences on what this means for business leaders: strategy, supply chain, regulation, or competitive dynamics.

Be concise, factual, and directly useful to shareholders, investors, and business people.`,
          },
          {
            role: "user",
            content: `Analyze this article:\n\n${text.slice(0, 6000)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[analyze] OpenAI error", res.status, err);
      let message = "Analysis request failed.";
      try {
        const parsed = JSON.parse(err) as { error?: { message?: string; code?: string } };
        if (parsed.error?.code === "insufficient_quota") {
          message = "OpenAI quota exceeded. Add billing at platform.openai.com or try again later.";
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
      implications?: string;
      opportunities?: string[];
      forShareholders?: string;
      forInvestors?: string;
      forBusiness?: string;
    };

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    const implications = typeof parsed.implications === "string" ? parsed.implications.trim() : null;
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const forShareholders = typeof parsed.forShareholders === "string" ? parsed.forShareholders.trim() : null;
    const forInvestors = typeof parsed.forInvestors === "string" ? parsed.forInvestors.trim() : null;
    const forBusiness = typeof parsed.forBusiness === "string" ? parsed.forBusiness.trim() : null;

    await prisma.article.update({
      where: { id },
      data: {
        entities,
        topics,
        implications,
        opportunities,
        forShareholders,
        forInvestors,
        forBusiness,
      },
    });

    return NextResponse.json({
      ok: true,
      id,
      entities,
      topics,
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
