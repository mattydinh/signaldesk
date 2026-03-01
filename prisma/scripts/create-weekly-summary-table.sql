-- Run this once in Supabase SQL Editor (or any Postgres client) to create the WeeklySummary table.
-- Then you never need to run prisma db push for this table.

CREATE TABLE IF NOT EXISTS "WeeklySummary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "summaryText" TEXT NOT NULL,
  "keyTrends" JSONB NOT NULL,
  "impactedSectors" JSONB NOT NULL,
  "geopoliticalScore" DOUBLE PRECISION,
  "investorSignal" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklySummary_weekStart_key" UNIQUE ("weekStart")
);

CREATE INDEX IF NOT EXISTS "WeeklySummary_weekStart_idx" ON "WeeklySummary" ("weekStart" DESC);
