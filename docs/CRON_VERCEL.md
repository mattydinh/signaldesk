# Vercel cron configuration

## Current schedule

- **Path:** `/api/cron/run-all`
- **Schedule:** `0 10 * * *` — once per day at 10:00 UTC

That single job runs: ingest → analyze → pipeline part 1 → prune; on Wed it also runs fetch-fundamentals; on Sun it also runs pipeline part 2 and generate-weekly-summary.

## Why once per day?

**Vercel Hobby plan** allows only **one cron execution per day** per job. Schedules that run more often (e.g. `0 * * * *` for hourly) **fail deployment** with:

> Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day.

So the app uses a daily run to stay within Hobby limits and allow deployments to succeed.

## If you're on Pro

On **Pro**, you can run more frequently (e.g. hourly). In `vercel.json`:

```json
"crons": [
  { "path": "/api/cron/run-all", "schedule": "0 * * * *" }
]
```

## Other limits

- **run-all** has `maxDuration = 300` (5 min). Pro supports long-running functions; Hobby may cap at 60s depending on region — if the cron times out, run pipeline part 1 and part 2 as separate scheduled jobs or trigger them manually.
- Cron invocations count as serverless function invocations (1M/month included on Hobby).
