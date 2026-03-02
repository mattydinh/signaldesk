/**
 * Turn Prisma/DB error messages into short, user-friendly text
 * so we don't expose connection strings or server hostnames in the UI.
 */
export function formatDbError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("authentication failed") ||
    m.includes("credentials") ||
    m.includes("tenant or user not found") ||
    m.includes("password") ||
    m.includes("fatal")
  ) {
    return "Database connection failed. Check that POSTGRES_PRISMA_URL (or DATABASE_URL) in .env uses your Supabase pooler URL (port 6543) and the correct password. On Vercel, check the project environment variables.";
  }
  if (m.includes("can't reach") || m.includes("connection refused") || m.includes("econnrefused")) {
    return "Database unreachable. Check your connection string and that the database is running.";
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return "Request timed out. Try running the pipeline in two parts (part=1 then part=2) from cron.";
  }
  return message;
}
