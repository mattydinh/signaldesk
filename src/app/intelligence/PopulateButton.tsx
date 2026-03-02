"use client";

import { useState } from "react";
import { runPipelineAction } from "./actions";

export default function PopulateButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setStatus("loading");
    setMessage("");
    const result = await runPipelineAction();
    if (result.ok) {
      setStatus("done");
      setMessage("Done. Refreshing…");
      window.location.reload();
    } else {
      setStatus("error");
      setMessage(result.error ?? "Pipeline failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="rounded-btn border border-[#3F3F46] bg-[#27272A] px-4 py-2 text-body font-medium text-foreground hover:bg-[#3F3F46] disabled:opacity-50"
      >
        {status === "loading" ? "Running pipeline…" : "Populate intelligence data"}
      </button>
      {status === "done" && <p className="text-meta text-[#34D399]">{message}</p>}
      {status === "error" && <p className="text-meta text-[#F87171]">{message}</p>}
    </div>
  );
}
