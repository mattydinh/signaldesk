# SignalDesk

**Financial & political intelligence, simplified.** SignalDesk turns the day’s news into clear, actionable intelligence for shareholders, investors, and business leaders. Your feed refreshes daily (or on demand), and AI summarizes each story and spells out what it means for you—so you see the signal, not just the noise.

- **Dashboard (Feed)** — Article-by-article intelligence with search and category filters.
- **Weekly Brief** — A synthesized summary of the past week’s coverage: key trends, sector impact, and investor implications. Generated automatically each Sunday (or on demand via cron).
- **Intelligence** — Third page: regime classification, derived signals, and backtested performance. Data comes from the ML pipeline (events → event_features → daily_topic_metrics → derived_signals → regime_snapshot). Run `npx prisma db push` once to create the pipeline tables.

**Live:** [signaldesk-chi.vercel.app](https://signaldesk-chi.vercel.app)

*Product copy and taglines for non-technical users: [docs/PRODUCT_COPY.md](docs/PRODUCT_COPY.md)*

## Tech stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase** — REST API for data (sources, articles, ingest, analyze). Optional Prisma + Postgres for non-Supabase setups.
- **Vercel Blob** — Feed list store (workaround when Supabase list query is limited). Optional **Vercel KV** as alternative.
- **Groq** (default) or **OpenAI** — AI summaries and implications per article.
- **Vercel** — Hosting, cron, env.

## Setup

```bash
npm install
cp .env.example .env   # then fill in env vars
npx prisma generate
npx prisma db push    # if using Prisma + Postgres
npm run dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| **SUPABASE_URL** | Yes (recommended) | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes (recommended) | Supabase API → service_role secret. Used for ingest, articles, sources. |
| **BLOB_READ_WRITE_TOKEN** | For feed list | Vercel Blob store token. When set, feed list is read/written from Blob so the dashboard shows all articles. |
| **NEWS_API_KEY** | For “Fetch news now” | [newsapi.org](https://newsapi.org) key. |
| **GROQ_API_KEY** | For summaries | [console.groq.com](https://console.groq.com) — preferred (free tier). Or **OPENAI_API_KEY** for OpenAI. |
| **DASHBOARD_PASSWORD** | Optional | If set, /dashboard requires login via /login. |
| **CRON_SECRET** | Optional | Protects cron endpoints (ingest-news, prune-articles, generate-weekly-summary). |
| **INGEST_API_KEY** | Optional | Protects POST /api/news/ingest. |
| **POSTGRES_PRISMA_URL** | For Weekly Brief | Postgres connection string (e.g. Supabase). Required for the Weekly Summary feature and cron. |
| **ARTICLE_RETENTION_DAYS** | Optional | Days to keep articles in the feed (default 30). Set to 0 to disable retention filter and prune. |

For **local dev** without Supabase REST: add **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** to `.env` so the app uses the REST API instead of Prisma + pooler (avoids “Tenant or user not found”).

## Features

- **Dashboard (Feed)** — Intelligence feed: search, category filter by tag, “Fetch news now”, article cards with AI summary and implications (shareholders / investors / business). Analyze button and auto-analyze on fetch when an API key is set.
- **Weekly Brief** — Route: `/weekly`. Shows up to four weekly summaries. Each brief is generated from the last 7 days of articles and includes a headline, key trends, geopolitical assessment, sector impact (with direction), and investor implications. When the week has little coverage on certain themes, the brief still summarizes what is in the feed. Cron: GET /api/cron/generate-weekly-summary (Sundays 18:00 UTC). Requires the `WeeklySummary` table; one-time SQL is in `prisma/scripts/create-weekly-summary-table.sql` (run in Supabase SQL Editor).
- **News ingestion** — POST /api/news/ingest (body: `{ articles: [...] }`). Cron: GET /api/cron/ingest-news (pulls from News API).
- **AI analysis** — POST /api/articles/[id]/analyze (Groq or OpenAI). Writes entities, topics, opportunities, implications, forShareholders, forInvestors, forBusiness.
- **Feed store** — When BLOB_READ_WRITE_TOKEN is set, ingest writes the article list to Vercel Blob and the dashboard reads from it. See [docs/FEED_STORE_OPTIONS.md](docs/FEED_STORE_OPTIONS.md) for Blob vs KV.
- **Article retention** — Articles older than 30 days (configurable via **ARTICLE_RETENTION_DAYS**) are excluded from the feed. Cron: GET /api/cron/prune-articles (daily) removes old rows from the database.

## Deploy (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. In Vercel → **Settings → Environment Variables**, add at least:
   - **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY**
   - **BLOB_READ_WRITE_TOKEN** (create a Blob store in Vercel → Storage)
   - **NEWS_API_KEY**, **GROQ_API_KEY** (or OPENAI_API_KEY)
3. For **Weekly Brief**: ensure **POSTGRES_PRISMA_URL** is set, then run the SQL in `prisma/scripts/create-weekly-summary-table.sql` once in Supabase → SQL Editor to create the `WeeklySummary` table.
4. Deploy.
5. For **Intelligence** (ML pipeline): run `npx prisma db push` once so the pipeline tables exist (`Event`, `EventFeature`, `DailyTopicMetric`, `DerivedSignal`, `MarketPrice`, `RegimeSnapshot`, `BacktestResult`). New article ingest dual-writes to `Event`; pipeline jobs (event features → daily topic metrics → derived signals → market prices → regime → backtest) populate the rest. **Run the pipeline once after deploy** (or on a schedule):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/run-pipeline"
```

If **CRON_SECRET** is set, the request must include it. Optionally add a Vercel cron schedule for `GET /api/cron/run-pipeline` (e.g. daily). Also set **CRON_SECRET**, **DASHBOARD_PASSWORD**, **INGEST_API_KEY**, **ARTICLE_RETENTION_DAYS** as needed.

**Debug:** GET `/api/debug-db` shows which DB/feed store is in use. GET `/api/debug-articles` inspects raw Supabase article list response.

**Intelligence page blank or pipeline all zeros?** See [docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md](docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md) for causes and fixes (backfill-events + run-pipeline).

**Backfill Blob → Supabase:** If the dashboard shows many articles (from Blob) but your Supabase `Article` table has only a few rows, run the one-time backfill so all feed items exist in Supabase:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/backfill-articles"
```

Then in Supabase SQL Editor you can run:

```sql
SELECT a.id, a.title, a.summary, a."publishedAt", a.categories, s.name AS source_name
FROM public."Article" a
LEFT JOIN public."Source" s ON a."sourceId" = s.id
ORDER BY a."publishedAt" DESC NULLS LAST
LIMIT 50;
```

## Scripts

- `npm run dev` — Local dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npx prisma db push` — Push schema to DB (when using Prisma)
- `npx prisma studio` — Open Prisma Studio

---

*SignalDesk — Financial & Political Intelligence*
