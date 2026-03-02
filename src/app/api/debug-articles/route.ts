import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ARTICLE_TABLE = process.env.SUPABASE_ARTICLE_TABLE ?? "Article";

function allowDebug(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim() ??
    request.nextUrl.searchParams.get("secret")?.trim();
  return provided === secret;
}

/**
 * GET /api/debug-articles — inspect raw Supabase article list response.
 * In production, requires CRON_SECRET in ?secret= or Authorization: Bearer.
 */
export async function GET(request: NextRequest) {
  if (!allowDebug(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" });
  }
  const sb = supabase as any;
  const cols = "id,sourceId,title,publishedAt";
  const limit = 10;

  const results: Record<string, { rowCount: number; count: number | null; error: string | null; sampleIds: string[] }> = {};

  for (const table of [ARTICLE_TABLE, ARTICLE_TABLE === "Article" ? "article" : "Article"]) {
    try {
      const r = await sb.from(table).select(cols, { count: "exact" }).order("publishedAt", { ascending: false }).limit(limit);
      const data = Array.isArray((r as { data?: unknown }).data) ? (r as { data: unknown[] }).data : [];
      const count = (r as { count?: number }).count ?? null;
      const err = (r as { error?: { message?: string } }).error;
      results[table] = {
        rowCount: data.length,
        count: typeof count === "number" ? count : null,
        error: err ? String(err.message ?? err) : null,
        sampleIds: (data as { id?: string }[]).slice(0, 3).map((row) => row?.id ?? ""),
      };
    } catch (e) {
      results[table] = { rowCount: 0, count: null, error: String(e), sampleIds: [] };
    }
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let directFetch: { table: string; status: number; contentRange: string | null; bodyLength: number; isArray: boolean }[] = [];
  if (url && key) {
    for (const table of [ARTICLE_TABLE, "article"]) {
      try {
        const res = await fetch(
          `${url.replace(/\/$/, "")}/rest/v1/${table}?select=id&order=publishedAt.desc`,
          {
            headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-9" },
            cache: "no-store",
          }
        );
        const body = await res.text();
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          // ignore
        }
        directFetch.push({
          table,
          status: res.status,
          contentRange: res.headers.get("Content-Range"),
          bodyLength: body.length,
          isArray: Array.isArray(parsed),
        });
      } catch (e) {
        directFetch.push({ table, status: 0, contentRange: null, bodyLength: 0, isArray: false });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    clientQueries: results,
    directFetch,
    hint: "If clientQueries and directFetch both show 1 row, the issue may be RLS or table/schema naming in Supabase.",
  });
}
