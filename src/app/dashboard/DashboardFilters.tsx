"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ARTICLE_CATEGORIES } from "@/lib/categories";

type Source = { id: string; name: string };

export default function DashboardFilters({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [sourceId, setSourceId] = useState(searchParams.get("sourceId") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (sourceId) params.set("sourceId", sourceId);
    if (category) params.set("category", category);
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }, [q, sourceId, category, router]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="search" className="block text-xs font-medium text-muted-foreground">
          Search
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search title or summary..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
        />
      </div>
      <div className="min-w-[140px]">
        <label htmlFor="category" className="block text-xs font-medium text-muted-foreground">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
        >
          <option value="">All categories</option>
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px]">
        <label htmlFor="source" className="block text-xs font-medium text-muted-foreground">
          Source
        </label>
        <select
          id="source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={apply}
        className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-95 transition-opacity"
      >
        Apply
      </button>
    </div>
  );
}
