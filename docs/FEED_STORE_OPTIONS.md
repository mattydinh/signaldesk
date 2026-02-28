# Feed store options (workaround for Supabase list bug)

When the Supabase article list returns only 1 row, the dashboard can use a **feed store** instead. Ingest still writes to Supabase; the **list** is read from Blob or KV.

## Option A: Vercel Blob (recommended)

1. In Vercel: **Storage** → **Create Database** → **Blob**.
2. Create a Blob store; Vercel adds `BLOB_READ_WRITE_TOKEN` to your project.
3. Redeploy. After the next **Fetch news now**, the feed is written to Blob and the dashboard reads from it.

No code changes. The app checks for `BLOB_READ_WRITE_TOKEN` and uses Blob for the article list when set.

## Option B: Vercel KV (Upstash Redis)

1. In Vercel: **Integrations** or **Marketplace** → add **Upstash Redis** (or the Redis integration that provides KV).
2. Connect the store; you get `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy. After the next **Fetch news now**, the feed is written to KV and the dashboard reads from it.

**Priority:** If both are set, **Blob is tried first**, then KV, then Supabase + in-memory cache.

## Check which store is active

- **GET** `/api/debug-db` → `feedStore: { blob: true, kv: false }` (or similar).

## Flow

- **Ingest:** Articles are saved to Supabase and, when configured, to Blob and/or KV.
- **Dashboard list:** Reads from Blob (if token set) → else KV (if env set) → else Supabase + in-memory fallback.
