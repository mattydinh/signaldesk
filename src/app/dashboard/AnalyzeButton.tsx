"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnalyzeButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/analyze`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? "Analyzing article…" : "Run AI analysis on this article"}
        className="shrink-0 rounded-btn border-2 border-primary/50 bg-primary/10 px-4 py-2 text-caption font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 transition-colors"
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>
      {error && (
        <span className="text-caption text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
