"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type Source = { id: string; name: string };

export default function DashboardFilters({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [sourceId, setSourceId] = useState(searchParams.get("sourceId") ?? "");

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (sourceId) params.set("sourceId", sourceId);
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }, [q, sourceId, router]);

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
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
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="min-w-[160px]">
        <label htmlFor="source" className="block text-xs font-medium text-muted-foreground">
          Source
        </label>
        <select
          id="source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Apply
      </button>
    </div>
  );
}
