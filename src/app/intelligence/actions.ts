"use server";

import { runPipeline } from "@/lib/pipeline/run";
import { formatDbError } from "@/lib/format-db-error";

export async function runPipelineAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await runPipeline();
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Pipeline failed";
    console.error("[intelligence] runPipelineAction", e);
    return { ok: false, error: formatDbError(raw) };
  }
}
