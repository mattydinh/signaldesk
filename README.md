# SignalDesk

**Financial & political intelligence, simplified.** SignalDesk ingests news, runs an ML pipeline to extract signals, and surfaces regime classification and sector intelligence — so you see the signal, not just the noise.

**Live:** [signaldesk-chi.vercel.app](https://signaldesk-chi.vercel.app) · **Spec:** [SPEC.md](SPEC.md)

---

## Tech Stack

- **Next.js 15** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase** — PostgreSQL database + REST API
- **Prisma** — ORM for ML pipeline tables
- **Groq** (default) or **OpenAI** — AI article analysis
- **Vercel** — Hosting + daily cron

---

## Local Setup

```bash
npm install
cp .env.example .env   # fill in env vars
npm run db:generate    # generate Prisma client
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role secret |
| `POSTGRES_PRISMA_URL` | Yes | Postgres connection string (Supabase pooler, port 6543) |
| `DATABASE_URL` | Yes | Same as above (used by Prisma migrations) |
| `GROQ_API_KEY` | For analysis | [console.groq.com](https://console.groq.com) — free tier |
| `OPENAI_API_KEY` | For analysis | Alternative to Groq |
| `CRON_SECRET` | Recommended | Protects `/api/cron/*` endpoints |
| `DASHBOARD_PASSWORD` | Optional | If set, `/dashboard` requires login |
| `INGEST_API_KEY` | Optional | Protects `POST /api/news/ingest` |
| `EIA_API_KEY` | For fundamentals | [eia.gov/opendata](https://www.eia.gov/opendata/register.php) |

---

## Deploy (Vercel)

1. Push to GitHub and import in [Vercel](https://vercel.com)
2. Add environment variables in Vercel → Settings → Environment Variables
3. Run once to create ML pipeline tables:
   ```bash
   npx prisma db push
   ```
4. Deploy — the daily cron at `GET /api/cron/run-all` handles everything automatically

**Cron:** Runs once daily at 10:00 UTC (Vercel Hobby plan limit). Handles ingest → analysis → pipeline → prune. Wednesday adds EIA/rig data. Sunday adds regime + backtest + weekly summary.

**Intelligence page blank?** See [docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md](docs/RUNBOOK_INTELLIGENCE_AND_INGEST.md).

---

## Scripts

```bash
npm run dev          # local dev server
npm run build        # production build
npm run db:generate  # generate Prisma client
npm test             # run Vitest tests
npx prisma db push   # push schema to DB
npx prisma studio    # open Prisma Studio
```

---

*For product vision, roadmap, and architecture: see [SPEC.md](SPEC.md)*
