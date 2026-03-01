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
    <div className="flex flex-wrap items-end gap-6">
      <div className="min-w-[200px] flex-1 max-w-md">
        <label htmlFor="search" className="block text-meta font-medium text-[#A1A1AA]">
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
            className="block w-full rounded-badge border border-[#27272A] bg-[#111113] px-4 py-2.5 text-body text-foreground placeholder:text-[#71717A] focus-visible:ring-2 focus-visible:ring-[#27272A] focus:border-[#3F3F46]"
          />
          <button
            type="button"
            onClick={search}
            className="shrink-0 rounded-pill border border-[#27272A] bg-transparent px-4 py-2 text-body font-medium text-foreground hover:bg-[#18181B] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-150"
          >
            Search
          </button>
        </div>
      </div>
      <div className="min-w-[160px]">
        <label htmlFor="filter-tag" className="block text-meta font-medium text-[#A1A1AA]">
          Filter by tag
        </label>
        <select
          id="filter-tag"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter articles by category tag"
          className="mt-2 block w-full rounded-pill border border-[#27272A] bg-transparent py-2 pl-4 pr-8 text-body text-foreground focus-visible:ring-2 focus-visible:ring-[#27272A] focus:border-[#3F3F46]"
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
