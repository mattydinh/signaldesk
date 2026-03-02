"use server";

import { runPipeline } from "@/lib/pipeline/run";

export async function runPipelineAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await runPipeline();
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pipeline failed";
    console.error("[intelligence] runPipelineAction", e);
    return { ok: false, error: message };
  }
}
