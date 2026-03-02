import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/debug-db — troubleshoot DB connection (no secrets).
 * In production, requires CRON_SECRET in ?secret= or Authorization: Bearer.
 */
export const dynamic = "force-dynamic";

function allowDebug(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // no secret set: allow (backward compat)
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim() ??
    request.nextUrl.searchParams.get("secret")?.trim();
  return provided === secret;
}

export async function GET(request: NextRequest) {
  if (!allowDebug(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({
      ok: false,
      message: "POSTGRES_PRISMA_URL (or DATABASE_URL) is not set.",
      hint: "Connect Supabase in Vercel (Settings → Integrations) or add POSTGRES_PRISMA_URL in Environment Variables.",
    });
  }
  const source = process.env.POSTGRES_PRISMA_URL ? "POSTGRES_PRISMA_URL" : "DATABASE_URL";
  const hasSupabaseUrl = !!(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const usingSupabaseApi = hasSupabaseUrl && hasServiceRoleKey;
  const isPooler = url.includes("pooler.supabase.com");
  const isDirect = url.includes("db.") && url.includes("supabase.co");
  let region: string | null = null;
  const match = url.match(/aws-0-([a-z0-9-]+)\.pooler\.supabase\.com/);
  if (match) region = match[1];

  const feedBlob = !!(process.env.BLOB_READ_WRITE_TOKEN);
  const feedKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  const startsWithPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");
  const expectedHost = "aws-0-us-west-2.pooler.supabase.com";
  const hasExpectedHost = url.includes(expectedHost);

  return NextResponse.json({
    ok: true,
    hasUrl: true,
    envVar: source,
    usingSupabaseApi,
    supabaseEnv: { hasSupabaseUrl, hasServiceRoleKey },
    usingPooler: isPooler,
    usingDirect: isDirect,
    region: region ?? (isPooler ? "could not parse" : null),
    feedStore: { blob: feedBlob, kv: feedKv },
    urlCheck: {
      startsWithPostgres,
      hasExpectedHost,
      urlLength: url.length,
    },
    hint: !usingSupabaseApi && hasSupabaseUrl
      ? "Supabase REST API is OFF: SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel (Supabase Dashboard → Settings → API → service_role secret) and redeploy."
      : !usingSupabaseApi && hasServiceRoleKey
        ? "Supabase REST API is OFF: Supabase URL not set. Add SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in Vercel and redeploy."
        : isDirect
          ? "You are still using the DIRECT connection (db.*.supabase.co). Use the POOLER URL (port 6543) or enable Supabase REST (see supabaseEnv)."
          : isPooler
            ? "Using pooler. If connection still fails, enable Supabase REST (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) or try a different region."
            : "Unknown URL format.",
  });
}
