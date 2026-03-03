import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Use integration's var if set; else fall back to common names (e.g. manual DATABASE_URL or POSTGRES_URL)
let url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
if (url) {
  // Supavisor/transaction mode requires pgbouncer=true so Prisma doesn't use prepared statements
  try {
    const parsed = new URL(url.replace(/^postgresql:\/\//, "https://"));
    parsed.searchParams.set("pgbouncer", "true");
    url = parsed.toString().replace(/^https:\/\//, "postgresql://");
  } catch {
    url = url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
