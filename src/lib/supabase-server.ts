import { createClient } from "@supabase/supabase-js";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

/**
 * Server-side Supabase client with service role (bypasses RLS).
 * Use for API routes and server actions. Only created when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseAdmin;
}

/** True when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (use REST API instead of Prisma connection). */
export function hasSupabaseDb(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
