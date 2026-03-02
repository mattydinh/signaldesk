# Runbook: Intelligence page blank & articles not showing

**When to use this:** Users report the Intelligence page is empty (no regime, no signals, no performance), or the Dashboard shows no/few articles.

---

## How the data flows (so you know where it can break)

```
RSS feeds / "Fetch news now"
    → ingest (Supabase Article table + Blob feed)
    → createEventFromArticle() for each NEW article only → Event table

Event table
    → run-pipeline (event_features → daily_topic_metrics → derived_signals → market_prices → regime → backtest)
    → RegimeSnapshot, DerivedSignal, BacktestResult tables

Intelligence page
    → reads RegimeSnapshot, DerivedSignal, BacktestResult (via Prisma)
```

- **Dashboard articles:** When `BLOB_READ_WRITE_TOKEN` is set, the feed list comes from **Blob** (written on each ingest). If Blob is empty, the dashboard can show "No articles" even if Supabase has rows. When Blob has data, articles show; analysis fields (categories, implications) are merged from Supabase.
- **Intelligence data:** Comes only from the **pipeline**. The pipeline needs **Event** rows. Events are created only when **new** articles are ingested (each new insert calls `createEventFromArticle`). If all ingest runs had `created: 0` (everything skipped as duplicate), the **Event table stays empty** → pipeline has nothing to process → Intelligence stays blank.

---

## Fix 1: Intelligence page blank (no signals / regime / performance)

**Cause:** Event table is empty (no Events = pipeline has no input).

**Fix (one-time backfill + pipeline):**

1. Deploy the `backfill-events` cron if not already deployed (see repo).
2. **Run two requests** (Vercel has a ~60s function limit; backfill + pipeline together can timeout):
   - **Step 1 – backfill Events only:**
     ```bash
     curl -sS "https://YOUR_APP.vercel.app/api/cron/backfill-events?secret=YOUR_CRON_SECRET"
     ```
     Wait for `{"ok":true,"backfilled":N,...}`.
   - **Step 2 – run the pipeline** (Vercel has a 60s function limit; run in two parts to avoid timeout):
     ```bash
     curl -sS "https://YOUR_APP.vercel.app/api/cron/run-pipeline?secret=YOUR_CRON_SECRET&part=1"
     ```
     Wait for JSON, then:
     ```bash
     curl -sS "https://YOUR_APP.vercel.app/api/cron/run-pipeline?secret=YOUR_CRON_SECRET&part=2"
     ```
     Wait for `{"ok":true,"results":{...}}`.
3. Refresh the **Intelligence** page; regime, signals, and performance should appear.

**If you hit `FUNCTION_INVOCATION_TIMEOUT`:** Use `&part=1` then `&part=2` as above. Without `part`, the full pipeline runs in one request and may exceed 60s.

**Note:** `?runPipeline=1` on backfill-events runs the pipeline in the same request; on Vercel Hobby/free tier this often hits `FUNCTION_INVOCATION_TIMEOUT`. Prefer backfill + pipeline part=1 + part=2.

---

## Fix 2: Dashboard shows no articles

**Possible causes:**

- **Blob empty:** Feed list is read from Blob when `BLOB_READ_WRITE_TOKEN` is set. If Blob was never written or was cleared, the dashboard shows nothing.
- **Supabase has articles but Blob doesn’t:** e.g. articles were added only via DB/API and ingest never wrote to Blob.

**Checks:**

1. **Supabase → Table Editor → Article:** Do you have rows? If yes, articles exist in DB.
2. **Vercel → Environment Variables:** Is `BLOB_READ_WRITE_TOKEN` set? If yes, the app expects the feed from Blob.

**Fix:**

- **Option A – Ingest again (writes to both Supabase and Blob):**  
  Run ingest so new or existing logic writes the feed to Blob:

  ```bash
  curl -sS "https://YOUR_APP.vercel.app/api/cron/ingest-news?secret=YOUR_CRON_SECRET"
  ```

  If the News API returns new headlines, `created` will be > 0 and new articles + Events are added; the same run also updates the Blob feed. If everything is skipped (`created: 0`), the Blob feed is still updated from the current batch of articles fetched from the API (so the list can repopulate if it was empty).

- **Option B – Backfill Blob from Supabase:**  
  If you have articles in Supabase but Blob is empty, use the backfill-articles cron (reads from Blob and writes to Supabase – so this is for the opposite direction: Blob → Supabase). For “Supabase has data, Blob empty” we don’t have a dedicated backfill in this runbook; ensure ingest runs (Option A) so Blob gets written.

---

## Fix 3: Pipeline runs but results are still zeros

**Typical response:**  
`event_features: { processed: 0 }, daily_topic_metrics: { rowsUpserted: 0 }, ...`

**Cause:** No rows in **Event** table (or Prisma can’t read them, e.g. wrong DB or RLS).

**Fix:**

1. Run **backfill-events** (with or without `runPipeline=1`) so Events exist.
2. If you already ran backfill and Events exist in Supabase, confirm the app’s Postgres URL (`POSTGRES_PRISMA_URL`) points to the **same** Supabase project and that there are no RLS policies blocking the pooler/role used by Prisma.

---

## Quick reference: cron endpoints

| Endpoint | Purpose |
|----------|--------|
| `GET /api/cron/ingest-news?secret=...` | Fetch news from configured RSS feeds, ingest into Supabase + Blob, create Events for new articles, then run pipeline. |
| `GET /api/cron/backfill-events?secret=...` | Create Event rows for existing articles that don’t have one. |
| `GET /api/cron/backfill-events?secret=...&runPipeline=1` | Same as above, then run the full ML pipeline (fixes Intelligence in one call). |
| `GET /api/cron/run-pipeline?secret=...` | Run the full ML pipeline (may timeout on Vercel 60s limit). |
| `GET /api/cron/run-pipeline?secret=...&part=1` | Pipeline part 1: event features → topic metrics → derived signals. |
| `GET /api/cron/run-pipeline?secret=...&part=2` | Pipeline part 2: market prices → regime → backtest. Use after part=1 to avoid timeout. |

---

## For the team: why Intelligence was blank

1. **Events are created only on new article insert.**  
   Every ingest that returned `created: 0` added no new articles, so no new Events. The pipeline only processes **Event** rows; with zero Events it correctly returns zeros and the Intelligence page has nothing to show.

2. **Backfill-events fixes historical data.**  
   It creates one Event per existing article in Supabase that doesn’t already have an Event. After that, running the pipeline (or using `runPipeline=1` on backfill) fills RegimeSnapshot, DerivedSignal, and BacktestResult so the Intelligence page works.

3. **Going forward:**  
   New ingests (new articles) will create Events and the pipeline runs after ingest-news, so Intelligence will keep updating. No need to run backfill-events again unless you add a lot of articles outside of ingest (e.g. manual DB inserts) and want them in the pipeline.
