# RSS Ingestion Pipeline Audit

**Date:** 2025-03-02  
**Symptom:** March articles present in RSS feeds (confirmed via `/api/debug/feed-dates`) but not appearing in the dashboard. Fetch shows "230 we fetched were already in your feed."

---

## 1. Trace: Where is the RSS fetch job triggered?

| Trigger | Path | Schedule |
|---------|------|----------|
| **Cron** | `GET /api/cron/ingest-news` | `0 13 * * *` (13:00 UTC daily) |
| **Cron** | `GET /api/cron/daily` | `0 9 * * *` — includes `fetchAndIngestNews()` |
| **Dashboard** | "Fetch news now" → `fetchNewsNow()` | User-initiated |
| **GitHub Actions** | `.github/workflows/fetch-news.yml` | On workflow run |
| **API** | `POST /api/news/ingest` | External (body: `{ articles }`) |

**Flow:** `fetchAndIngestNews()` → `fetchAllRssArticles()` (fetch-rss.ts) → `ingestArticles()` (ingest.ts) → `ingestArticlesSupabase()` (data-supabase.ts)

---

## 2. Deduplication Logic

### In fetch-rss.ts (pre-ingest)

1. **Per-feed:** `externalId` = normalized URL when available, else `fallbackExternalId(sourceSlug, title, publishedAt, guid, index)`
2. **Cross-feed:** Dedupe by `url` (or `title|source|date`) before ingest
3. **Uniqueness:** `(sourceSlug:externalId)` guaranteed unique via suffix if collision

### In data-supabase.ts (ingest)

1. **existingSet:** SELECT all fetched `externalIds` from Article table (chunked, tries both `externalId` and `external_id` column names)
2. **Skip:** If `a.externalId in existingSet` → skip (article already in DB)
3. **Insert:** Only articles not in existingSet

**Potential issue:** If the Supabase SELECT returns wrong column names or fails, `existingSet` is empty → we try to INSERT all 230. If unique constraint exists on `externalId`, batch insert fails, fallback to individual inserts, each fails → all counted as `skipped` but no rows added. Same symptom: "230 already in feed."

---

## 3. DB Schema Constraints

**Prisma schema (Article):**

- `externalId String?` — no `@unique`
- Prisma creates Postgres columns; unquoted identifiers may lowercase to `externalid`

**Supabase:** May use different schema (e.g. snake_case: `external_id`, `published_at`). Column naming mismatch can cause:

- SELECT `.in("externalId", ids)` to fail if column is `external_id`
- ORDER BY `publishedAt` to fail or sort incorrectly if column is `published_at`

---

## 4. Timezone / Date Filtering

- **Ingest:** `publishedAt` parsed via `new Date(s).toISOString()` — no explicit filter by `published_at > NOW()`
- **Dashboard query:** `publishedAt >= (now - retentionDays)` — no upper bound
- **Sort:** `order("publishedAt", { ascending: false })` — newest first

No timezone bug identified that would drop March articles.

---

## 5. Frontend Query

**Dashboard:** Calls `getArticlesSupabase({ limit: 50, retentionDays: 30 })`

- **Supabase:** `select(...).order("publishedAt", false).gte("publishedAt", publishedAfter).range(0, fetchSize-1)`
- **Filter:** `publishedAt >= (now - 30 days)`
- **Order:** `publishedAt DESC`, then `id DESC`
- **Limit:** fetchSize = min(200, max(limit*3, offset+limit*2)), then slice for pagination

**If column is `published_at`:** PostgREST may error or ignore `.order("publishedAt")` — check Supabase logs.

---

## 6. Caching

- **Dashboard:** `export const dynamic = "force-dynamic"` — no static cache
- **RSS fetch:** `cache: "no-store"` — no HTTP cache
- **After fetch:** `revalidatePath("/dashboard")` — invalidates Next.js cache
- **ISR / edge:** None configured for article list

---

## 7. Debug Endpoint Added

**GET /api/debug/rss-status**

Returns:

- `last_fetch_timestamp`
- `articles_fetched_count`
- `articles_inserted_count`
- `articles_skipped_count`
- `last_error`
- `pipeline_stage`

**With ?run=1:** Runs live diagnostic (fetch RSS only, no ingest) and checks how many `externalIds` exist in Supabase.

---

## Root Cause Hypotheses (in order of likelihood)

1. **Supabase column naming:** Table uses snake_case (`external_id`, `published_at`) but code expects camelCase. SELECT for existingSet fails or returns empty → we try to insert all 230 → unique constraint fails → all counted as skipped.

2. **Unique constraint on externalId:** If DB has `UNIQUE(external_id)` or `UNIQUE(source_id, external_id)`, inserts for duplicates fail. With broken existing check (hypothesis 1), we'd hit this.

3. **Feed cache (Blob) vs Supabase:** When Supabase is configured, the dashboard reads from Supabase directly (not Blob). Blob is only used when Supabase is not configured or returns 0 rows. So Blob is not the cause.

4. **ORDER BY column mismatch:** If `published_at` is the real column but we order by `publishedAt`, sorting could be wrong — but wouldn't explain "no new articles."

---

## Next Steps

1. **Call `/api/debug/rss-status?run=1`** — Check `live_diagnostic.external_ids_in_db` vs `articles_fetched`. If `external_ids_in_db === articles_fetched` → all are in DB (dedup working). If `external_ids_in_db === 0` → SELECT is failing.

2. **Inspect Supabase table schema** — Confirm column names: `externalId` vs `external_id`, `publishedAt` vs `published_at`.

3. **Check Vercel logs** — After a fetch, look for `[data-supabase] existingSet size:` and `[data-supabase] batch insert attempt` to see if SELECT/insert succeed.
