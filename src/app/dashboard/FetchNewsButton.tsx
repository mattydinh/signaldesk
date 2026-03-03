"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchNewsNow } from "./actions";

export default function FetchNewsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await fetchNewsNow();
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      router.refresh();
      setStatus("success");
      const created = result.created ?? 0;
      const skipped = result.skipped ?? 0;
      const totalFetched = result.total ?? 0;
      let msg: string;
      if (totalFetched === 0) {
        msg = "No new articles from RSS feeds.";
      } else if (created === 0) {
        msg = `No new articles — the ${totalFetched} we fetched were already in your feed.`;
      } else {
        msg = `Loaded ${created} new article${created !== 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} already in feed)` : ""}. Analysis runs automatically via cron.`;
      }
      setMessage(msg);
    } catch (e: unknown) {
      setStatus("error");
      const err = e as { message?: string; digest?: string };
      setMessage(err?.message || err?.digest || "Something went wrong. Check Vercel logs for details.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        aria-live="polite"
        className="rounded-badge bg-primary px-6 py-2.5 text-body font-semibold text-primary-foreground hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 transition-all duration-150"
      >
        {status === "loading" ? "Fetching…" : "Fetch news now"}
      </button>
      {message && (
        <p
          className={`text-body ${status === "error" ? "text-[#F87171]" : "text-[#A1A1AA]"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
