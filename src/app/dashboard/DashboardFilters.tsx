"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export default function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const search = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }, [q, router]);

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
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-shadow"
        />
      </div>
    </div>
  );
}
