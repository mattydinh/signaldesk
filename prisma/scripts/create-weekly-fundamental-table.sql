-- Create WeeklyFundamental table for EIA inventory + Baker Hughes rig count (Phase 2).
-- Run this once in Supabase → SQL Editor if prisma db push doesn't reach your DB.

CREATE TABLE IF NOT EXISTS "WeeklyFundamental" (
  "series" TEXT NOT NULL,
  "report_date" DATE NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyFundamental_pkey" PRIMARY KEY ("series", "report_date")
);

CREATE INDEX IF NOT EXISTS "WeeklyFundamental_series_report_date_idx"
  ON "WeeklyFundamental" ("series", "report_date" DESC);
