import { createClient } from "@supabase/supabase-js";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

/** URL from SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (integration sometimes sets only the latter). */
function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Server-side Supabase client with service role (bypasses RLS).
 * Use for API routes and server actions when Supabase keys are set.
 */
export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseAdmin;
}

/** True when we have Supabase URL + service role key (use REST API instead of Prisma). */
export function hasSupabaseDb(): boolean {
  return !!(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
