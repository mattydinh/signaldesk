# Architecture & scalability audit (summary)

One-time tech-lead pass over design, limits, and security. See below for what was fixed and what to consider next.

---

## What’s in good shape

- **App structure:** Clear App Router layout; cron vs data vs auth routes separated; lib holds shared pipeline, DB, and Supabase logic.
- **Data layer:** Prisma uses pooler URL with `pgbouncer=true`; Supabase REST used for Article/Event when configured; dual-write (Event) and prune keep stores in sync.
- **Pipeline:** Split into part=1 (features → metrics → signals) and part=2 (prices → regime → backtest) to stay under Vercel serverless timeout; steps use upserts (idempotent).
- **Error handling:** Intelligence page and actions use `formatDbError()` so users don’t see raw DB/connection strings.
- **Docs:** README, runbook (Intelligence + ingest), and env table give ops enough to deploy and troubleshoot.

---

## Fixes applied (from this audit)

1. **Pipeline scalability** – `runDailyTopicMetrics` now caps event load with `take: 20_000` so a 90-day window can’t blow memory or timeout.
2. **Cron timeouts** – `maxDuration` set on:
   - `prune-articles`: 60s  
   - `backfill-articles`: 120s  
   (generate-weekly-summary and others already had limits.)
3. **Debug routes** – `/api/debug-db` and `/api/debug-articles` in **production** now require `CRON_SECRET` (query `?secret=` or `Authorization: Bearer`). In dev they remain open. If `CRON_SECRET` is not set in prod, debug routes still allow access (backward compat).

---

## Recommendations for later (not done in this pass)

1. **Auth** – Dashboard cookie currently stores the actual password. Prefer a session token (e.g. signed cookie or DB-backed session). Consider protecting `/intelligence` and `/weekly` with the same middleware when `DASHBOARD_PASSWORD` is set.
2. **Cron secret** – In production, consider requiring `CRON_SECRET` (fail closed: return 401 when unset) so cron endpoints aren’t publicly callable if the env is missing.
3. **run-pipeline on a schedule** – It’s not in `vercel.json`; Intelligence can go stale. Add a daily cron (e.g. two entries for part=1 and part=2) or document an external cron that hits the run-pipeline endpoint.
4. **Retries** – No app-level retry for transient DB/API failures. Adding retries with backoff for pipeline steps or ingest would improve resilience.
5. **Backfill N+1** – backfill-articles does one Supabase round-trip per article; batching (where the API allows) would reduce latency and failure points.

---

## Quick reference

| Area           | Detail |
|----------------|--------|
| Crons in vercel.json | ingest-news (daily 09:00 UTC), prune-articles (04:00 UTC), generate-weekly-summary (Sundays 18:00 UTC). run-pipeline is manual/external. |
| maxDuration    | ingest-news 120s, run-pipeline 60s, generate-weekly-summary 60s, prune-articles 60s, backfill-articles 120s, backfill-events 120s, intelligence page 90s. |
| Debug in prod  | Require `?secret=CRON_SECRET` or `Authorization: Bearer CRON_SECRET` for /api/debug-db and /api/debug-articles. |
