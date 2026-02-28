# SignalDesk

**Financial & political intelligence, simplified.** SignalDesk turns the day’s news into clear, actionable intelligence for shareholders, investors, and business leaders. Your feed refreshes daily (or on demand), and AI summarizes each story and spells out what it means for you—so you see the signal, not just the noise.

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
| **CRON_SECRET** | Optional | Protects GET /api/cron/ingest-news. |
| **INGEST_API_KEY** | Optional | Protects POST /api/news/ingest. |

For **local dev** without Supabase REST: add **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** to `.env` so the app uses the REST API instead of Prisma + pooler (avoids “Tenant or user not found”).

## Features

- **Dashboard** — Intelligence feed: search, source filter, “Fetch news now”, article cards with AI summary and implications (shareholders / investors / business). Analyze button and auto-analyze on fetch when an API key is set.
- **News ingestion** — POST /api/news/ingest (body: `{ articles: [...] }`). Cron: GET /api/cron/ingest-news (pulls from News API).
- **AI analysis** — POST /api/articles/[id]/analyze (Groq or OpenAI). Writes entities, topics, opportunities, implications, forShareholders, forInvestors, forBusiness.
- **Feed store** — When BLOB_READ_WRITE_TOKEN is set, ingest writes the article list to Vercel Blob and the dashboard reads from it. See [docs/FEED_STORE_OPTIONS.md](docs/FEED_STORE_OPTIONS.md) for Blob vs KV.

## Deploy (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. In Vercel → **Settings → Environment Variables**, add at least:
   - **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY**
   - **BLOB_READ_WRITE_TOKEN** (create a Blob store in Vercel → Storage)
   - **NEWS_API_KEY**, **GROQ_API_KEY** (or OPENAI_API_KEY)
3. Deploy. Optionally set **CRON_SECRET**, **DASHBOARD_PASSWORD**, **INGEST_API_KEY**.

**Debug:** GET `/api/debug-db` shows which DB/feed store is in use. GET `/api/debug-articles` inspects raw Supabase article list response.

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
