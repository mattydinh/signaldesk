"use server";

import { revalidatePath } from "next/cache";
import { fetchAndIngestNews } from "@/lib/fetch-news";

export type FetchNewsResult = Awaited<ReturnType<typeof fetchAndIngestNews>>;

export async function fetchNewsNow(): Promise<FetchNewsResult> {
  const result = await fetchAndIngestNews();
  revalidatePath("/dashboard");
  return result;
}
