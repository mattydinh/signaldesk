# SignalDesk

AI-powered financial & political intelligence platform. Ingests news from APIs, full-text search, optional auth, and AI-generated opportunities and implications for shareholders, investors, and business.

## Tech stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Prisma** + **PostgreSQL** (Supabase or Neon)
- **Vercel** (cron, serverless)

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Database**  
   Create PostgreSQL (e.g. [Supabase](https://supabase.com)). Copy `.env.example` to `.env` and set **POSTGRES_PRISMA_URL** to your pooler URI (Supabase → Project Settings → Database → Connection string → URI, Session pooler, port 6543).

3. **Schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Features

### News ingestion

- **POST /api/news/ingest** — Body: `{ articles: [{ sourceName, title, summary?, url?, publishedAt?, externalId? }] }`. Optional **INGEST_API_KEY**: if set, request must include `x-api-key` or `Authorization: Bearer`.
- **GET /api/cron/ingest-news** — Fetches US business + general headlines from [News API](https://newsapi.org). Requires **NEWS_API_KEY** and (recommended) **CRON_SECRET** (`?secret=...` or `Authorization: Bearer`). On Vercel, cron runs hourly (`vercel.json`).

### Search & articles

- **GET /api/articles?page=1&limit=20&sourceId=...&q=...** — Paginated list. **q** uses PostgreSQL full-text search (title + summary). **sourceId** filters by source.
- **GET /api/sources** — List sources for filters.

### AI analysis

- **POST /api/articles/[id]/analyze** — Entities, topics, opportunities, and implications for shareholders/investors/business (requires **OPENAI_API_KEY**).

### Dashboard

- **/dashboard** — Intelligence feed: search, source filter, article cards with Analyze button and (when run) opportunities and audience implications. Optional **DASHBOARD_PASSWORD** protects the page; then **/login** is required.

### Auth (optional)

- **DASHBOARD_PASSWORD** — If set, visiting **/dashboard** redirects to **/login**. **POST /api/auth/login** with `{ password }` sets cookie; **POST /api/auth/logout** clears it.
- **INGEST_API_KEY** — If set, **POST /api/news/ingest** requires header `x-api-key` or `Authorization: Bearer`.
- **CRON_SECRET** — If set, **GET /api/cron/ingest-news** requires `?secret=...` or `Authorization: Bearer`.

## Deploy (Vercel)

1. Push repo to GitHub and import in [Vercel](https://vercel.com).
2. **Database (required for /api/articles and dashboard):**
   - **Recommended:** Install the [Supabase integration](https://vercel.com/integrations/supabase) and connect your Supabase project. The app will use **Supabase’s REST API** (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) for all DB access when those are set, avoiding Postgres connection/pooler issues on Vercel. No need to configure POSTGRES_PRISMA_URL if the integration sets the Supabase keys.
   - **Or with Prisma:** Set **POSTGRES_PRISMA_URL** to your Supabase **pooler** URI (port 6543). The app injects `?pgbouncer=true` automatically for pooler compatibility.
   - If you see "relation does not exist" with the REST API, your DB may use lowercase table names. Set **SUPABASE_SOURCE_TABLE**=source and **SUPABASE_ARTICLE_TABLE**=article in Vercel (optional).
   - If your Supabase project is **paused** (free tier), restore it in the Supabase dashboard.
3. Add other env vars as needed: **NEWS_API_KEY**, **CRON_SECRET**, **OPENAI_API_KEY**, **INGEST_API_KEY**, **DASHBOARD_PASSWORD**.
4. Deploy. Cron runs daily and calls **/api/cron/ingest-news** (set **CRON_SECRET** if you protect the endpoint).

### Troubleshooting DB on Vercel

- **See what the app is using:** Open **https://your-app.vercel.app/api/debug-db**. It reports which env var is set, pooler vs direct, and **region**. If you see "Tenant or user not found", the region in the URL often doesn’t match your project (e.g. URL says `us-west-2` but project is East US).
- **Force us-east-1:** In **Vercel → Settings → Environment Variables**, set **POSTGRES_PRISMA_URL** to the pooler URI with **us-east-1** in the host. Format (replace `YOUR_PASSWORD` with your DB password; URL-encode special chars like `!` → `%21`):
  ```
  postgresql://postgres.lmqpijkepixbjgpwdojz:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
  ```
  Save, then **Redeploy** the project.
- **Region reference:** Supabase Dashboard → Project Settings → General shows **Region** (East US → `us-east-1`, West US (Oregon) → `us-west-2`). The pooler host must match: `aws-0-<region>.pooler.supabase.com`.
