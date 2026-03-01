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
      setMessage(
        result.total === 0
          ? "No new articles from News API."
          : `Loaded ${result.created} new article${result.created !== 1 ? "s" : ""} (${result.skipped} already existed).${shouldAnalyze ? " Analysis complete." : ""}`
      );
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
        className="rounded-btn gradient-primary px-6 py-3 text-body-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 transition-opacity"
      >
        {status === "loading" ? "Fetching…" : status === "analyzing" ? "Analyzing…" : "Fetch news now"}
      </button>
      {message && (
        <p
          className={`text-body-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
