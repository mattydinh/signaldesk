-- Run this once in Supabase SQL Editor to create the ML pipeline tables.
-- Then the Intelligence page and pipeline jobs can use them.
-- (Alternative: run `npx prisma db push` from the project root if you have POSTGRES_PRISMA_URL set.)

-- Event: unified content (news / future Twitter)
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL,
  "raw_text" TEXT NOT NULL,
  "clean_text" TEXT,
  "entities" TEXT[] DEFAULT '{}',
  "categories" TEXT[] DEFAULT '{}',
  "url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Event_published_at_idx" ON "Event" ("published_at" DESC);
CREATE INDEX IF NOT EXISTS "Event_source_idx" ON "Event" ("source");

-- EventFeature: NLP outputs per event
CREATE TABLE IF NOT EXISTS "EventFeature" (
  "event_id" TEXT NOT NULL PRIMARY KEY,
  "sentiment_score" DOUBLE PRECISION NOT NULL,
  "sentiment_confidence" DOUBLE PRECISION NOT NULL,
  "regulation_score" DOUBLE PRECISION NOT NULL,
  "geopolitical_risk_score" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFeature_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- DailyTopicMetric: topic x date aggregates
CREATE TABLE IF NOT EXISTS "DailyTopicMetric" (
  "topic" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "article_count" INTEGER NOT NULL,
  "avg_sentiment" DOUBLE PRECISION NOT NULL,
  "sentiment_std" DOUBLE PRECISION NOT NULL,
  "sentiment_change_7d" DOUBLE PRECISION NOT NULL,
  "volume_zscore" DOUBLE PRECISION NOT NULL,
  PRIMARY KEY ("topic", "date")
);
CREATE INDEX IF NOT EXISTS "DailyTopicMetric_date_idx" ON "DailyTopicMetric" ("date" DESC);

-- DerivedSignal: date x signal_name
CREATE TABLE IF NOT EXISTS "DerivedSignal" (
  "date" DATE NOT NULL,
  "signal_name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "zscore" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  PRIMARY KEY ("date", "signal_name")
);
CREATE INDEX IF NOT EXISTS "DerivedSignal_signal_name_idx" ON "DerivedSignal" ("signal_name");
CREATE INDEX IF NOT EXISTS "DerivedSignal_date_idx" ON "DerivedSignal" ("date" DESC);

-- MarketPrice: ticker x date OHLCV + daily return
CREATE TABLE IF NOT EXISTS "MarketPrice" (
  "ticker" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "open" DOUBLE PRECISION NOT NULL,
  "high" DOUBLE PRECISION NOT NULL,
  "low" DOUBLE PRECISION NOT NULL,
  "close" DOUBLE PRECISION NOT NULL,
  "volume" BIGINT NOT NULL,
  "daily_return" DOUBLE PRECISION NOT NULL,
  PRIMARY KEY ("ticker", "date")
);
CREATE INDEX IF NOT EXISTS "MarketPrice_date_idx" ON "MarketPrice" ("date" DESC);

-- RegimeSnapshot: one row per date
CREATE TABLE IF NOT EXISTS "RegimeSnapshot" (
  "date" DATE NOT NULL PRIMARY KEY,
  "regime" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "drivers" TEXT[] DEFAULT '{}'
);

-- BacktestResult: backtest runs
CREATE TABLE IF NOT EXISTS "BacktestResult" (
  "signal_name" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "cumulative_return" DOUBLE PRECISION NOT NULL,
  "annualized_return" DOUBLE PRECISION NOT NULL,
  "annualized_volatility" DOUBLE PRECISION NOT NULL,
  "sharpe" DOUBLE PRECISION NOT NULL,
  "max_drawdown" DOUBLE PRECISION NOT NULL,
  "turnover" DOUBLE PRECISION NOT NULL,
  "hit_rate" DOUBLE PRECISION NOT NULL,
  PRIMARY KEY ("signal_name", "ticker", "start_date", "end_date")
);
