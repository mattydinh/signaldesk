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
        className="shrink-0 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
