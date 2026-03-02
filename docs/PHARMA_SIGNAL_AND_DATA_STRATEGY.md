# Replicable Pharma Signal, Tagging, and Twitter — Notes

Early conversation: replicable pharma signal, News API / tagging quality, and Twitter API.

---

## 1. Replicable pharma signal (same pattern as Oil & Gas)

**Yes, we can build a replicable pharma signal** using the same design as the Oil & Gas spec:

- **Existing:** We already have **Healthcare** in `ARTICLE_CATEGORIES` and in `CATEGORY_KEYWORDS` (`/healthcare|pharma|drug|fda|vaccine|medical|biotech|hospital/i`). We do **not** yet have Healthcare in `SIGNAL_DEFS` in `derived-signals.ts` (we have Geopolitics, Regulation, Markets, Finance, Technology, War & Conflict, and will add Energy for oil).
- **Pharma composite (concept):** Same pattern as oil: add `HealthcareSentiment`, `PharmaNewsVolume` (or `HealthcareVolume`) from `daily_topic_metrics`; add a price/fundamental component (e.g. XLV or a pharma index ETF, or FDA/approval data if available); z-scores and weighted composite; backtest vs XLV/SPY. No new tables—same `derived_signals`, `market_prices`, `backtest_results`.
- **Blocker for quality:** Replicability depends on **how well articles are tagged** so that Healthcare (and pharma-specific) content actually lands in the Healthcare topic. Right now that depends on (a) News API returning enough pharma/health headlines, and (b) our tagging (see below) putting them in Healthcare.

So: **structurally replicable**; **quality** depends on data and tagging.

---

## 2. News API and tagging — current state

**News API**

- We pull **US top-headlines** for `business` and `general` only ([fetch-news.ts](src/lib/fetch-news.ts)). That can under-represent niche sectors (pharma, energy) unless those topics show up in general/business headlines.
- To improve coverage for pharma (and oil): add **targeted queries**—e.g. News API “everything” with `q=pharma OR FDA OR drug approval` or `q=oil OR OPEC OR crude`—so we get more sector-specific articles. Same ingest pipeline; more relevant raw input.

**Tagging: two paths**

| Where | Who tags | Used for |
|-------|----------|----------|
| **Article** (Supabase) | AI (Groq/OpenAI) via POST /api/articles/[id]/analyze | Dashboard filter, card labels, implications. Categories stored on Article. |
| **Event** (pipeline) | **Keyword inference only** | ML pipeline: daily_topic_metrics → derived_signals. Events are created with **empty categories**; pipeline uses `inferCategoriesFromText( rawText )` at run time. |

So: **the pipeline does not use AI tags.** Events are created at ingest with `categories: []`. When we build `daily_topic_metrics`, we use `inferCategoriesFromText(e.rawText, null)` (title + summary, keyword rules). AI-assigned categories on the Article are never written to the Event. That’s why “intelligent tagging” (AI) helps the dashboard and search, but **not** the signals—unless we change that.

---

## 3. Is current tagging sufficient? How to improve

**For a replicable pharma (and oil) signal:**

- **Keyword inference** is the only thing driving topic aggregation today. Healthcare keywords are broad: `healthcare|pharma|drug|fda|vaccine|medical|biotech|hospital`. That can miss “Pfizer”, “Eli Lilly”, “GLP-1”, “approval”, “phase 3” unless we add them. Same idea for Energy: we could add more oil/gas terms.
- **Improvements (pick one or combine):**

  **A) Sync AI categories to Event**  
  When we run analyze (or in a batch job after ingest), **update the Event** with the Article’s AI-assigned categories (and optionally entities/topics). Then the pipeline uses AI tags for topic aggregation instead of keyword inference. Pros: better nuance (e.g. pharma vs general healthcare). Cons: events created before analyze still use inference unless we backfill; need to add an “update Event from Article” step.

  **B) Stronger keyword lists**  
  Add more terms to `CATEGORY_KEYWORDS` for Healthcare (e.g. drug names, “FDA”, “approval”, “phase 3”, “clinical trial”, “biotech”) and Energy (already has oil/gas/OPEC; could add more). No schema change; pipeline stays inference-only but with better recall for pharma/energy.

  **C) Hybrid**  
  Use AI categories on Event when present; fall back to `inferCategoriesFromText` when Event.categories is empty. Requires (A) plus backfill or “analyze then update Event” flow.

**Recommendation:** For **replicable, dependable** sector signals (pharma, oil), (A) or (C) is better long-term so the pipeline benefits from AI tagging. (B) is a quick win and helps if we don’t want to touch Event creation yet.

---

## 4. Twitter / X API — do we have it? What does it cost?

**Do we have Twitter API?**

- **No.** There is no Twitter/X API integration in the repo. The only references are:
  - [events.ts](src/lib/events.ts): `source: "news" | "twitter"` in the type (placeholder for future).
  - [DATA_SOURCES_AND_CATEGORIES.md](docs/DATA_SOURCES_AND_CATEGORIES.md): “Twitter/X or Reddit APIs … can be ingested as another source type; same pipeline gives categories and investor implications.”

So the **design** allows a future “twitter” source and the same pipeline would tag and summarize; **implementation** is not started.

**Does it cost money?**

- **Yes.** X (Twitter) API is paid except for a very small free tier:
  - **Free:** ~100 reads/month (not enough for a real feed).
  - **Basic:** ~$200/month (or ~$175/month annually) — ~15k reads/month.
  - **Pro:** ~$5,000/month — ~1M reads/month.
  - **Pay-per-use** (2025): e.g. ~$0.005 per read; can add up quickly for streaming or large pulls.
- Third-party providers (e.g. GetXAPI, TwitterAPI.io) often offer cheaper per-request pricing but add a dependency and ToS considerations.

**Implications**

- Adding Twitter as a source means **budgeting** for at least Basic (or pay-per-use) and designing around rate limits.
- Same pipeline can consume tweets as “events” (title = tweet text, summary = null or truncated, source = "twitter") and run the same category inference or AI analysis and composite signals. So **replicable pharma (or oil) signal from Twitter** is possible once we have ingest and tagging (and possibly sentiment) for tweets.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| Can we build a replicable pharma signal? | Yes, same pattern as Oil & Gas (Healthcare topic + optional price/fundamental + composite + backtest). |
| Is News API data dependable enough? | Coverage for pharma (and energy) improves if we add targeted queries (e.g. pharma, FDA, oil) alongside top-headlines. |
| Is our tagging sufficient? | Pipeline today uses **keyword inference only** (Events have no categories; we infer from title/summary). AI tags live on Articles for the dashboard only. For better pharma/oil signals: sync AI categories to Events and/or strengthen keyword lists. |
| Do we have Twitter API? | No integration yet; only type and docs mention it. |
| Does Twitter API cost money? | Yes; free tier is tiny. Basic ~$200/mo or pay-per-use; Pro ~$5k/mo for high volume. |

Next steps could be: (1) add Healthcare (and Energy) to derived signals and one pharma composite spec (like the oil spec), (2) decide on sync-AI-to-Event vs keyword-only and implement one, (3) add News API “everything” queries for pharma/energy, (4) document Twitter as a future source and cost so you can plan when to add it.
