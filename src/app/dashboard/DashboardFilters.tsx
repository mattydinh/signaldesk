"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ARTICLE_CATEGORIES } from "@/lib/categories";

export default function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const category = searchParams.get("category") ?? "";

  const search = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }, [q, category, router]);

  const setCategory = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("category", value);
      else params.delete("category");
      if (!params.has("q") && !params.has("category")) {
        router.push("/dashboard");
        return;
      }
      router.push(`/dashboard?${params}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-[200px] flex-1 max-w-md">
        <label htmlFor="search" className="block text-caption font-medium text-muted-foreground">
          Search
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="search"
            type="search"
            role="searchbox"
            aria-label="Search articles by title or summary"
            placeholder="Search title or summary..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            className="block w-full rounded-btn border border-input bg-card px-4 py-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
          />
          <button
            type="button"
            onClick={search}
            className="shrink-0 rounded-btn border border-border bg-secondary px-4 py-3 text-body-sm font-medium text-secondary-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Search
          </button>
        </div>
      </div>
      <div className="min-w-[160px]">
        <label htmlFor="filter-tag" className="block text-caption font-medium text-muted-foreground">
          Filter by tag
        </label>
        <select
          id="filter-tag"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter articles by category tag"
          className="mt-2 block w-full rounded-btn border border-input bg-card px-4 py-3 text-body-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
        >
          <option value="">All tags</option>
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
