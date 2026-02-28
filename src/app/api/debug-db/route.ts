import { NextResponse } from "next/server";

/**
 * GET /api/debug-db — troubleshoot DB connection (no secrets).
 * Remove or protect this in production.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({
      ok: false,
      message: "POSTGRES_PRISMA_URL (or DATABASE_URL) is not set.",
      hint: "Connect Supabase in Vercel (Settings → Integrations) or add POSTGRES_PRISMA_URL in Environment Variables.",
    });
  }
  const source = process.env.POSTGRES_PRISMA_URL ? "POSTGRES_PRISMA_URL" : "DATABASE_URL";
  const usingSupabaseApi = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const isPooler = url.includes("pooler.supabase.com");
  const isDirect = url.includes("db.") && url.includes("supabase.co");
  let region: string | null = null;
  const match = url.match(/aws-0-([a-z0-9-]+)\.pooler\.supabase\.com/);
  if (match) region = match[1];

  return NextResponse.json({
    ok: true,
    hasUrl: true,
    envVar: source,
    usingSupabaseApi,
    usingPooler: isPooler,
    usingDirect: isDirect,
    region: region ?? (isPooler ? "could not parse" : null),
    hint: isDirect
      ? "You are still using the DIRECT connection (db.*.supabase.co). Use the POOLER URL (port 6543, host *.pooler.supabase.com) in Vercel env vars and redeploy."
      : isPooler
        ? "Using pooler. If connection still fails, try a different region (e.g. us-west-1, eu-west-1)."
        : "Unknown URL format.",
  });
}
