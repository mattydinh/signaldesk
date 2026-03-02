"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchNewsNow } from "./actions";

const ANALYZE_CONCURRENCY = 3;
const ANALYZE_DELAY_MS = 400;

export default function FetchNewsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "analyzing" | "success" | "error">("idle");
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
      const ids = result.newArticleIds ?? [];
      const shouldAnalyze = (result as { hasAnalyzeProvider?: boolean }).hasAnalyzeProvider && ids.length > 0;
      if (shouldAnalyze) {
        setStatus("analyzing");
        setMessage(`Analyzing ${ids.length} new article${ids.length !== 1 ? "s" : ""}…`);
        for (let i = 0; i < ids.length; i += ANALYZE_CONCURRENCY) {
          const batch = ids.slice(i, i + ANALYZE_CONCURRENCY);
          await Promise.all(
            batch.map((id) =>
              fetch(`/api/articles/${id}/analyze`, { method: "POST" }).catch(() => null)
            )
          );
          if (i + ANALYZE_CONCURRENCY < ids.length) {
            await new Promise((r) => setTimeout(r, ANALYZE_DELAY_MS));
          }
        }
        router.refresh();
      }
      setStatus("success");
      const created = result.created ?? 0;
      const skipped = result.skipped ?? 0;
      const totalFetched = result.total ?? 0;
      let msg: string;
      if (totalFetched === 0) {
        msg = "No new articles from RSS feeds.";
      } else if (created === 0) {
        msg = `No new articles — the ${totalFetched} we fetched were already in your feed from these RSS sources. To see newer stories, check that your RSS feeds are updating and that RSS_FEEDS is configured correctly.`;
      } else {
        msg = `Loaded ${created} new article${created !== 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} already in feed)` : ""}.${shouldAnalyze ? " Analysis complete." : ""}`;
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
        disabled={status === "loading" || status === "analyzing"}
        aria-busy={status === "loading" || status === "analyzing"}
        aria-live="polite"
        className="rounded-badge bg-primary px-6 py-2.5 text-body font-semibold text-primary-foreground hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 transition-all duration-150"
      >
        {status === "loading" ? "Fetching…" : status === "analyzing" ? "Analyzing…" : "Fetch news now"}
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
