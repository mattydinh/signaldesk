"use client";

import { useState } from "react";
import { generateWeeklyBriefAction } from "./actions";

export default function GenerateBriefButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("loading");
    setMessage("");
    const result = await generateWeeklyBriefAction();
    if (result.ok) {
      if (result.skipped) {
        setMessage("Brief for that week already exists.");
      } else {
        setMessage("Brief created. Refreshing…");
      }
      setStatus("done");
      window.location.reload();
    } else {
      setStatus("error");
      setMessage(result.error ?? "Failed to generate brief");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="w-fit rounded-badge border border-[#3F3F46] bg-[#27272A] px-4 py-2 text-body font-medium text-foreground hover:bg-[#3F3F46] disabled:opacity-50"
      >
        {status === "loading" ? "Generating…" : "Generate weekly brief"}
      </button>
      {status === "done" && <p className="text-meta text-[#34D399]">{message}</p>}
      {status === "error" && <p className="text-meta text-[#F87171]">{message}</p>}
    </div>
  );
}
