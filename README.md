# SignalDesk

**Financial & political intelligence, simplified.** SignalDesk turns the day's news into clear, actionable intelligence for shareholders, investors, and business leaders. Your feed refreshes automatically every hour, and AI summarizes each story and spells out what it means for you—so you see the signal, not just the noise.

- **Dashboard (Feed)** — Clean article cards with category tags, entity badges, and an "Analyzed" indicator. Click any card to open a detail drawer with the full AI analysis.
- **Weekly Brief** — A synthesized summary of the past week's coverage: key trends, sector impact, and investor implications. Generated automatically each Sunday (or on demand via cron).
- **Intelligence** — Regime classification, derived signals, and backtested performance. Data comes from the ML pipeline (events → event_features → daily_topic_metrics → derived_signals → regime_snapshot). Run `npx prisma db push` once to create the pipeline tables.

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
| **RSS_FEEDS** | Optional override | Comma-separated list or JSON of RSS feed URLs to ingest. Defaults cover finance, geopolitics, energy, healthcare, and tech. |
| **GROQ_API_KEY** | For summaries | [console.groq.com](https://console.groq.com) — preferred (free tier). Or **OPENAI_API_KEY** for OpenAI. |
| **DASHBOARD_PASSWORD** | Optional | If set, /dashboard requires login via /login. |
| **CRON_SECRET** | Optional | Protects cron endpoints. |
| **INGEST_API_KEY** | Optional | Protects POST /api/news/ingest. |
| **POSTGRES_PRISMA_URL** | For Weekly Brief | Postgres connection string (e.g. Supabase). Required for the Weekly Summary feature and cron. |
| **ARTICLE_RETENTION_DAYS** | Optional | Days to keep articles in the feed (default 30). Set to 0 to disable retention filter and prune. |

For **local dev** without Supabase REST: add **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** to `.env` so the app uses the REST API instead of Prisma + pooler (avoids "Tenant or user not found").

## Architecture

### Single cron: `/api/cron/run-all`

One cron job runs every hour and handles the entire pipeline in sequence:

1. **Ingest** — Fetch RSS feeds and store new articles (~10s)
2. **Analyze** — Drip-feed up to 10 unanalyzed articles through Groq with 4s delays (~40s). Failed analyses stay unanalyzed and are retried next cycle automatically.
3. **Pipeline part 1** — Events → features → signals (~30-50s)
4. **Prune** — Remove articles older than retention period
5. **Weekly tasks** (conditional by UTC day):
   - **Wednesday**: Fetch fundamentals
   - **Sunday**: Pipeline part 2 + weekly summary generation

`maxDuration: 300` (5 min budget on Vercel Hobby).

### Analysis flow

- Articles start with `implications: null` after ingest
- The cron job queries unanalyzed articles (`implications IS NULL`) and analyzes up to 10 per cycle
- Groq free tier rate limit (6k TPM) is respected with 4s delays between requests
- Cards show a green "Analyzed" badge when analysis is complete
- The "Fetch news now" button only ingests — analysis runs automatically via cron

### Dashboard UX

- **Article cards** — Clean cards showing source, date, title, summary, category tags, entity badges, and implications preview. An "Analyzed" indicator (sparkle icon) shows which articles have AI analysis.
- **Detail drawer** — Click any card to slide open a drawer from the right with the full article and AI analysis: implications, opportunities, for shareholders, for investors, for business. The main feed remains scrollable while the drawer is open.
- **"Open article"** — External link button inside the drawer to read the full source article.

### Key modules

| Module | Purpose |
|--------|---------|
| `src/lib/analyze.ts` | Core analysis logic (Groq/OpenAI call, parse, save) |
| `src/lib/fetch-news.ts` | RSS fetch + ingest orchestration |
| `src/lib/ingest.ts` | Database-agnostic article ingestion |
| `src/lib/data-supabase.ts` | Supabase data access (articles, sources, unanalyzed query) |
| `src/lib/pipeline/run.ts` | ML pipeline runner (part 1 + part 2) |
| `src/lib/events.ts` | Event dual-write for ML pipeline |

## Features

- **Dashboard (Feed)** — Intelligence feed with search, category filters, and clickable article cards. Each card shows source, date, title, summary, category/entity tags, and an "Analyzed" badge. Clicking a card opens a slide-out drawer with the full AI analysis (implications, opportunities, shareholder/investor/business impact) and an "Open article" link to the source.
- **Weekly Brief** — Route: `/weekly`. Shows up to four weekly summaries. Each brief is generated from the last 7 days of articles and includes a headline, key trends, geopolitical assessment, sector impact (with direction), and investor implications. Cron: runs automatically on Sundays via `/api/cron/run-all`. Requires the `WeeklySummary` table; one-time SQL is in `prisma/scripts/create-weekly-summary-table.sql` (run in Supabase SQL Editor).
- **News ingestion** — POST /api/news/ingest (body: `{ articles: [...] }`). Cron: runs automatically via `/api/cron/run-all` every hour.
- **AI analysis** — POST /api/articles/[id]/analyze (Groq or OpenAI). Writes entities, topics, opportunities, implications, forShareholders, forInvestors, forBusiness. Fully automated via cron — up to 10 articles per cycle, failed analyses retry next cycle.
- **Feed store** — When BLOB_READ_WRITE_TOKEN is set, ingest writes the article list to Vercel Blob and the dashboard reads from it. See [docs/FEED_STORE_OPTIONS.md](docs/FEED_STORE_OPTIONS.md) for Blob vs KV.
- **Article retention** — Articles older than 30 days (configurable via **ARTICLE_RETENTION_DAYS**) are excluded from the feed. Pruning runs automatically via `/api/cron/run-all`.

## Deploy (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. In Vercel → **Settings → Environment Variables**, add at least:
   - **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY**
   - **BLOB_READ_WRITE_TOKEN** (create a Blob store in Vercel → Storage)
   - **GROQ_API_KEY** (or **OPENAI_API_KEY**) and optionally **RSS_FEEDS**
3. For **Weekly Brief**: ensure **POSTGRES_PRISMA_URL** is set, then run the SQL in `prisma/scripts/create-weekly-summary-table.sql` once in Supabase → SQL Editor to create the `WeeklySummary` table.
4. Deploy.
5. For **Intelligence** (ML pipeline): run `npx prisma db push` once so the pipeline tables exist (`Event`, `EventFeature`, `DailyTopicMetric`, `DerivedSignal`, `MarketPrice`, `RegimeSnapshot`, `BacktestResult`). New article ingest dual-writes to `Event`; the cron job runs the pipeline automatically.

Also set **CRON_SECRET**, **DASHBOARD_PASSWORD**, **INGEST_API_KEY**, **ARTICLE_RETENTION_DAYS** as needed.

**Cron schedule:** A single cron job runs every hour at `GET /api/cron/run-all`. It handles ingest, analysis, pipeline, pruning, and weekly tasks. If **CRON_SECRET** is set, the request must include it.

**Debug:** GET `/api/debug-db` shows which DB/feed store is in use. GET `/api/debug-articles` inspects raw Supabase article list response.

**RSS ingest:** By default, SignalDesk pulls from a curated set of RSS feeds (Reuters Business/World/Energy/Health, AP, BBC World, OilPrice, FDA, The Verge, Ars Technica, TechCrunch, etc.). To customize sources, set **RSS_FEEDS** to a comma-separated list of RSS URLs or a JSON array of `{ url, sourceName }` objects.

**Intelligence page blank or pipeline all zeros?** See [docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md](docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md) for causes and fixes (backfill-events + run-pipeline).

**Backfill Blob → Supabase:** If the dashboard shows many articles (from Blob) but your Supabase `Article` table has only a few rows, run the one-time backfill so all feed items exist in Supabase:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/backfill-articles"
```

## Scripts

- `npm run dev` — Local dev server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npx prisma db push` — Push schema to DB (when using Prisma)
- `npx prisma studio` — Open Prisma Studio

---

*SignalDesk — Financial & Political Intelligence*
