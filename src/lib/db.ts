import { PrismaClient } from "@prisma/client";

// Use integration's var if set; else fall back to common names (e.g. manual DATABASE_URL or POSTGRES_URL)
const url =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
if (url) process.env.POSTGRES_PRISMA_URL = url;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
