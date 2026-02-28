"use client";

import { useState } from "react";
import { fetchNewsNow } from "./actions";

export default function FetchNewsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setStatus("loading");
    setMessage("");
    try {
      const result = await fetchNewsNow();
      if (result.ok) {
        setStatus("success");
        setMessage(
          result.total === 0
            ? "No new articles from News API."
            : `Loaded ${result.created} new article${result.created !== 1 ? "s" : ""} (${result.skipped} already existed).`
        );
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status === "loading" ? "Fetching…" : "Fetch news now"}
      </button>
      {message && (
        <p
          className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
