# Implementation Plan: Weekly Intelligence Summary

**Based on:** Feature Spec v1.0 (Weekly Intelligence Summary Page)  
**Mode:** Plan only — no code changes until you approve or adjust.

---

## One-time setup: WeeklySummary table

The build does **not** run `prisma db push` (so Vercel deploys succeed even when the DB isn’t reachable from build). Create the `WeeklySummary` table once:

1. Copy **POSTGRES_PRISMA_URL** from Vercel (Project → Settings → Environment Variables) into a local `.env`.
2. From the project root run: **`npm run db:push`**
3. When it finishes, the table exists; `/weekly` and the Sunday cron will work.

---

## Audience & intent

- **Readers:** Finance, data science, scientists, software engineers; they invest in businesses, stocks, and crypto.
- **Goal:** Relevant news and actionable advice to inform investment decisions.
- **Empty / light weeks:** Always produce a brief. If there is no significant wartime or China-at-war news, say so explicitly, then summarize what *is* in the feed (markets, regulation, sectors, tech) with investor-relevant takeaways. No blank weeks.

---

## Overview

| Area | Scope |
|------|--------|
| **New routes** | `/weekly` (list), `/weekly/[id]` (full brief) |
| **New data** | Prisma model `WeeklySummary`; cron + service to generate once per week |
| **Data source** | Existing articles (last 7 days), filtered by theme keywords |
| **AI** | One structured summary per week via Groq/OpenAI (reuse existing pattern) |
| **UI** | Dark theme, 4 summary cards, escalation meter, sector badges |

---

## Phase 1: Data & Backend Foundation

### 1.1 Prisma model

- Add `WeeklySummary` to `prisma/schema.prisma` per spec.
- Map spec’s JSON shape to columns:
  - `title`, `summaryText` → from AI `title` + optional executive summary text.
  - `keyTrends` → `Json` (array of strings).
  - `impactedSectors` → `Json` (array of `{ sector, direction, reasoning }`).
  - `geopoliticalScore` → `Float?` (1–5 escalation).
  - `investorSignal` → `Json` (e.g. `{ geopoliticalAssessment, investorImplications }`).
- Add unique constraint so only one summary per week:  
  `@@unique([weekStart])` or `weekStart`/`weekEnd` pair.
- Run `prisma migrate` (or `npx prisma db push` for dev / first deploy) so the `WeeklySummary` table exists.

**Note:** If articles live only in Supabase (no Prisma `Article`), `WeeklySummary` still lives in Prisma on the same or different Postgres; generation service will read articles via existing Supabase/data layer.

### 1.2 Article fetch for “last 7 days”

- Spec: “Only analyze articles from the past 7 days.”
- Current data layer: `getArticlesSupabase` has `retentionDays` (e.g. 30) and `publishedAfter`; no upper bound or explicit “last 7 days” window.
- **Change:** Add optional **date range** to article fetch:
  - Either: `publishedAfter` + `publishedBefore` (ISO string or Date),
  - Or: `windowDays: 7` (implies last 7 days from now).
- Implement in:
  - `getArticlesSupabase` (Blob/KV filter + Supabase `.gte`/`.lte`),
  - and in `/api/articles` + any direct Prisma path so the weekly job can request “last 7 days” only.
- Keeps cron under 30s by not pulling 30 days of articles when we only need 7.

---

## Phase 2: Filtering & Topic Focus

### 2.1 Keyword filter (no new DB columns)

- Spec §6: Include only articles whose **content** (title + summary + implications/opportunities) matches at least one keyword phrase.
- **Implementation:** In `lib/weeklySummary.ts`, after fetching “last 7 days”:
  - Build one searchable text block per article: `title + summary + implications + opportunities + forInvestors + forShareholders + forBusiness`.
  - Apply a single regex or keyword list (China, CCP, Beijing, Taiwan, South China Sea, semiconductor exports, military, conflict, sanctions, defense spending, NATO, weapons transfer, regulation, SEC, policy change, interest rates, real estate, refinancing, commercial property).
  - Filter to articles that match at least one keyword; pass only these to the AI step.
- **Alternative:** Use Postgres full-text search or Supabase `ilike`/`or` if you prefer server-side filter; still need to expose “last 7 days + keyword filter” from the data layer.

### 2.2 “NLP classification” and clustering (scope decision)

- Spec §3.3–3.4: “Tag articles with …” and “Cluster articles by topic using embeddings.”
- **Current state:** No embeddings in the schema (comment in `Article`: “embedding vector(1536) — add with pgvector when ready”).
- **Recommendation for v1:**
  - **Skip embeddings and clustering** for the first version.
  - Rely on: (1) keyword filter above, and (2) one big AI call that receives all filtered article snippets and outputs the structured weekly summary. This keeps the cron simple and under 30s without pgvector or embedding cache.
  - **Later:** Add optional embedding column + pgvector, cache embeddings, then add clustering and/or multi-step “cluster → summarize per cluster → synthesize” if you need it.

---

## Phase 3: Generation Service & Cron

### 3.1 Service: `lib/weeklySummary.ts`

- **Function:** `generateWeeklySummary(weekStart: Date)` (or derive week from “this week” = Sunday–Saturday).
  - **Steps:**
    1. Compute `weekEnd = weekStart + 7 days` (or “now” if current week).
    2. Fetch articles with `publishedAt` in `[weekStart, weekEnd]` using the new date-range support.
    3. Optionally filter by theme keywords (Phase 2.1) to prioritize China/war/regulation/real estate; if that set is empty or very small, **still run generation** using the full week’s feed (or theme subset + a sample of the rest).
    4. **Always generate a summary.** If there’s no wartime/China-at-war news: instruct the AI to state that clearly, then give a short investor-oriented summary of what *is* in the feed (markets, regulation, sectors, tech) with key trends and implications. No blank weeks.
    5. Build a single prompt with concatenated article snippets (title + summary + implications, etc.) and the system prompt from spec §7, plus instructions for “empty theme” weeks (see above).
    6. Call Groq/OpenAI (reuse `getAnalyzeConfig()` pattern from analyze route); request **structured JSON** matching the spec’s shape (title, keyTrends, geopoliticalAssessment, sectorImpact, investorImplications).
    7. Parse response, validate shape, map to `WeeklySummary` fields.
    8. `prisma.weeklySummary.upsert` where `weekStart` is the unique key (create or skip if already exists).
- **Performance:** Limit total characters sent to the model (e.g. cap at 50–80 articles or ~100k chars) so the job stays under 30s; batch or truncate if needed.

**Prompt guidance (audience + empty weeks):**

- System prompt should state: readers are finance, data science, and engineering professionals who invest in businesses, stocks, and crypto; output should be relevant news and actionable investment advice.
- When the week has little or no China/wartime/conflict news: require the model to (1) say so explicitly (e.g. “No significant wartime or China-at-war developments this week”), and (2) still summarize what *is* in the feed—markets, regulation, sectors, tech—with key trends and investor implications. Never return a blank or “no news”-only brief.

### 3.2 Cron endpoint: `GET /api/cron/generate-weekly-summary`

- **Auth:** Same as other crons: require `CRON_SECRET` if set.
- **Schedule:** Sunday 18:00 UTC (Vercel cron in `vercel.json`).
- **Logic:**
  - Determine “this week’s” `weekStart` (e.g. last Sunday 00:00 UTC).
  - Check `prisma.weeklySummary.findUnique({ where: { weekStart } })`.
  - If exists → return `{ ok: true, skipped: "already exists" }`.
  - If not → call `generateWeeklySummary(weekStart)`, then return `{ ok: true, id: "…" }`.
- **Idempotent:** Safe to run multiple times; no duplicate summaries.

---

## Phase 4: Frontend

### 4.1 List page: `/weekly`

- **Layout:** Same shell as dashboard (header, nav if any); main content with:
  - H1: “Weekly Intelligence Brief”
  - Subtitle: “China geopolitics, US conflict exposure, and investor sector impact.”
  - Fetch last 4 `WeeklySummary` records (order by `weekStart` desc, take 4).
  - **Cards (4 max):**
    - Week range (e.g. “Feb 16 – Feb 22, 2026”)
    - Headline (`title`)
    - Escalation meter 1–5 (from `geopoliticalScore` or `investorSignal.geopoliticalAssessment.escalationLevel`)
    - Up to 3 key bullet points from `keyTrends`
    - Button: “View Full Brief” → `/weekly/[id]`
- **Empty state:** If no summaries yet, show “No briefs yet. The first one will appear after the weekly job runs (Sundays at 6 PM UTC).”

### 4.2 Detail page: `/weekly/[id]`

- Load `WeeklySummary` by `id` (or by slug if you add one).
- **Sections:**
  1. Executive Summary (e.g. `summaryText` or first part of structured content)
  2. Key Trends (list from `keyTrends`)
  3. Geopolitical Assessment (from `investorSignal.geopoliticalAssessment`: level + narrative)
  4. Sector Impact (table: Sector | Direction | Reasoning; direction badges: green = Positive, red = Negative, yellow = Neutral)
  5. Investor Implications (list from `investorSignal.investorImplications`)
  6. Risk / escalation indicator (1–2 Low, 3 Moderate, 4–5 Elevated)
- Reuse existing design tokens (dark theme, 8pt grid, type scale, `rounded-card`, etc.).

### 4.3 Navigation

- Add a link to “Weekly Brief” (or “Weekly”) in the header next to the dashboard/home so users can switch between feed and weekly.

---

## Phase 5: Retention & Constraints (Spec §10, §8)

- **Articles:** Already 30-day retention; weekly job only uses last 7 days. No change.
- **Weekly summaries:** Persist indefinitely; list page shows 4 most recent. Optional: later add “Archive” or pagination if you want more than 4.
- **30-second cap:** Achieved by: (1) fetching only 7 days of articles, (2) keyword filter before AI, (3) no embedding/clustering in v1, (4) one AI call with bounded input size. If you later add embeddings, keep caching and batch size limits.

---

## Dependency Summary

| Dependency | Action |
|------------|--------|
| Prisma | Add `WeeklySummary`, migrate |
| Article date range | Extend data layer + API with 7-day window |
| Groq/OpenAI | Reuse existing config; new prompt + JSON schema |
| Vercel cron | New entry in `vercel.json` for Sunday 18:00 UTC |
| UI | Two new pages + header link; reuse design system |

---

## Suggested Implementation Order

1. **Phase 1.1** — Add `WeeklySummary` model and migrate.
2. **Phase 1.2** — Add “last 7 days” (or date range) to article fetch; use it only in the weekly service at first.
3. **Phase 2.1** — Implement keyword filter in `lib/weeklySummary.ts`.
4. **Phase 3** — Implement `generateWeeklySummary()` and `/api/cron/generate-weekly-summary`; add cron to `vercel.json`; test with a manual run.
5. **Phase 4** — Build `/weekly` and `/weekly/[id]`; add nav link.

You can stop after any phase (e.g. cron + service without UI) and add the UI later.

---

## Open Decisions

1. **Week boundaries:** Sunday 00:00 UTC → next Sunday 00:00 UTC, or “rolling 7 days”? Spec says “one summary per week” and “4 per month” → fixed week (e.g. Sunday–Saturday) is the intended meaning.
2. **Empty week (resolved):** Always create a summary. If no/few theme-relevant articles: state “No significant wartime/China-at-war news this week” and still summarize the rest of the feed with investor-relevant takeaways. Audience: finance, data science, scientists, software engineers who invest in businesses, stocks, and crypto.
3. **Stored JSON shape:** Exact keys in `impactedSectors` and `investorSignal` should match what the AI prompt returns; the plan above aligns with the spec’s example. Finalize in the prompt template.

If you want to adjust phases, drop clustering for good, or add embedding in v1, we can update this plan and then implement step by step.
