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
   - **Recommended:** Install the [Supabase integration](https://vercel.com/integrations/supabase) for this Vercel project and connect your Supabase project. It sets **POSTGRES_PRISMA_URL** (and related vars) automatically; redeploy after connecting.
   - **Or manually:** In **Vercel → Settings → Environment Variables**, add **POSTGRES_PRISMA_URL** with your Supabase **pooler** URI (port 6543, from Supabase → Project Settings → Database → Connection string → URI). Do not use the direct connection (port 5432); serverless often can’t reach it.
   - If your Supabase project is **paused** (free tier), restore it in the Supabase dashboard.
3. Add other env vars as needed: **NEWS_API_KEY**, **CRON_SECRET**, **OPENAI_API_KEY**, **INGEST_API_KEY**, **DASHBOARD_PASSWORD**.
4. Deploy. Cron runs daily and calls **/api/cron/ingest-news** (set **CRON_SECRET** if you protect the endpoint).

### Troubleshooting DB on Vercel

- **See what the app is using:** Open **https://your-app.vercel.app/api/debug-db**. It reports which env var is set (POSTGRES_PRISMA_URL or DATABASE_URL), pooler vs direct, and region. Use the Supabase integration so **POSTGRES_PRISMA_URL** is set automatically, then redeploy.
- **Region:** Supabase Dashboard → Project Settings → General shows **Region** (e.g. East US → `us-east-1`). The pooler host must match: `aws-0-<region>.pooler.supabase.com`.
