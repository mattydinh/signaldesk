"use server";

import { revalidatePath } from "next/cache";
import { fetchAndIngestNews } from "@/lib/fetch-news";

export type FetchNewsResult = Awaited<ReturnType<typeof fetchAndIngestNews>>;

function hasAnalyzeProvider(): boolean {
  return !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

export async function fetchNewsNow(): Promise<FetchNewsResult & { hasAnalyzeProvider?: boolean }> {
  try {
    const result = await fetchAndIngestNews();
    if (result.ok) {
      revalidatePath("/dashboard");
    }
    return { ...result, hasAnalyzeProvider: hasAnalyzeProvider() };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch news failed.";
    console.error("[fetchNewsNow]", e);
    return { ok: false, error: message };
  }
}
