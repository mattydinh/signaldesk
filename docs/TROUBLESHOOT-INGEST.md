# Troubleshoot ingest / “no new articles”

## 1. Call ingest-news and read the full response

**PowerShell (run from project root):**
```powershell
$env:CRON_SECRET = "YOUR_CRON_SECRET"
.\scripts\call-ingest-news.ps1
```

Or with curl (bash/Git Bash):
```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://signaldesk-chi.vercel.app/api/cron/ingest-news"
```

**What to look for:**
- `"created": 0`, `"skipped": N` with large N → ingest is treating everything as already in feed (dedup or Supabase match).
- `"error": "..."` → fetch or ingest failed; the message is the cause.
- `"created": 0`, `"total": 0` → no articles from RSS (feed URLs or network).

## 2. Check Vercel function logs

1. Vercel dashboard → your project (**signaldesk**).
2. **Deployments** → open the **latest deployment**.
3. **Functions** (or **Logs**) → find logs for the request that hit `/api/cron/ingest-news`.

**Search for:**
- `[data-supabase] insert article failed` → Supabase rejected the insert; the next line usually has the reason.
- `[data-supabase] insert source failed` → Source table insert failed.
- `[fetch-rss] feed failed` → RSS feed returned non-2xx.

**Common error messages:**
- **RLS:** `new row violates row-level security policy` → Turn off RLS for the Article/Source tables or add policies that allow the service role.
- **Column:** `column X does not exist` → Schema mismatch (e.g. camelCase vs snake_case); check Supabase table columns.
- **Auth:** Invalid or expired `SUPABASE_SERVICE_ROLE_KEY` in Vercel → Update env in Vercel and redeploy.

Paste the **full response** from step 1 and any **log lines** from step 2 to debug further.
