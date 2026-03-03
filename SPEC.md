# SignalDesk — Product Specification

> Living document. Update this spec before building, not after.

---

## Vision

SignalDesk is a personal financial and political intelligence platform that ingests news,
extracts signals, and surfaces what matters — so you spend less time reading and more time
thinking. It is currently a personal tool, built to a standard that could become a product.

**The core loop:**
News → AI Analysis → ML Signals → Regime Classification → Actionable Intelligence

---

## What SignalDesk Does Today

### Shipped Features

| Feature | Description | Status |
|---|---|---|
| **Dashboard Feed** | RSS-ingested articles, AI-analyzed, filterable by sector/category | ✅ Live |
| **Weekly Brief** | Sunday AI-generated summary: key trends, sector impacts, investor signal | ✅ Live |
| **Intelligence — Oil & Gas** | 5-component composite signal with gauge, chart, backtest vs USO/XLE/SPY | ✅ Live |
| **Intelligence — Pharma** | 2-component composite signal with gauge, chart, backtest vs XLV/SPY | ✅ Live |
| **ML Pipeline** | Event extraction → NLP features → z-scored signals → regime classification → backtesting | ✅ Live |
| **Market Prices** | Yahoo Finance ingestion for SPY, XLE, USO, XLV | ✅ Live |
| **EIA / Rig Data** | Weekly fundamentals: crude inventory, Baker Hughes rig count | ✅ Live |
| **Login** | Password-protected dashboard | ✅ Live |

### Current Limitations

| Limitation | Root Cause | Impact |
|---|---|---|
| Pipeline runs once per day | Vercel Hobby: 1 cron/day | Signals are 12-24 hours stale |
| Max ~10 articles analyzed/day | Groq free tier: 6k TPM | Most articles never get AI analysis |
| Regime + backtest updates weekly | Single cron must fit 5 min | Intelligence data is weekly, not daily |
| No retry logic | Not built yet | Transient failures silently skip |

---

## Architecture Overview

```
RSS Feeds (20+ sources)
    ↓
Ingest → Article table (Supabase)
    ↓
AI Analysis (Groq) → Article enriched with entities/topics/implications
    ↓
Event extraction → Event table
    ↓
Pipeline Part 1 (daily):
  EventFeature → DailyTopicMetric → DerivedSignal → OilSignal → PharmaSignal
    ↓
Pipeline Part 2 (Sundays only):
  MarketPrice → RegimeSnapshot → BacktestResult
    ↓
Dashboard / Intelligence / Weekly Brief (Next.js App Router)
```

Single daily cron (`/api/cron/run-all` at 10:00 UTC) orchestrates everything.
Wednesday adds EIA/rig data. Sunday adds Part 2 + weekly summary.

---

## Data Sources

| Source | Type | Cadence | Notes |
|---|---|---|---|
| 20+ RSS feeds | News articles | Daily | Energy, pharma, macro, geopolitics |
| Groq (LLaMA) | AI analysis | Per article batch | Free tier: 6k TPM |
| Yahoo Finance | Market prices | Weekly (Part 2) | SPY, XLE, USO, XLV |
| EIA Open Data | Crude inventory | Weekly (Wednesday) | Free API |
| Baker Hughes | Rig count | Weekly (Wednesday) | Free |

**Parked (not building yet):**
- Twitter/X API — $200/mo minimum, not worth it at this stage
- NewsAPI — key stubbed in env, not wired into main ingest

---

## Signal Inventory

### Active (Computed Daily)

| Signal | Description | Window |
|---|---|---|
| `regulation_sentiment_signal` | Sentiment z-score for regulation news | 90 days |
| `geopolitical_risk_signal` | Volume z-score for geopolitical events | 90 days |
| `markets_sentiment_signal` | Sentiment z-score for market news | 90 days |
| `OilCompositeSignal` | 5-component oil/energy composite | 90 days |
| `PharmaCompositeSignal` | 2-component pharma composite | 90 days |

### Planned (Not Started)
- `OilStressSignal` / Energy Shock Risk
- Healthcare volume signal
- Macro/Fed sentiment signal

---

## Infrastructure Tiers

### Tier 1 — Current: Vercel Hobby (Free)
**Capabilities:** 1 cron/day, 5-min timeout, Groq free tier, Supabase free tier

**Constraints:** Signals 12-24h stale. ~10 articles analyzed/day. Regime/backtest weekly only.

**Best for:** Personal use, portfolio demo, validating the product concept.

---

### Tier 2 — Next: Vercel Pro (~$20/mo) + Groq Paid
**Unlocks:** Hourly crons, longer timeouts, daily Part 2, 50-100+ articles analyzed/day.

**Changes needed when upgrading:**
- Move cron to `0 * * * *` (hourly) in `vercel.json`
- Remove `utcDay` conditionals in `run-all` — run Part 2 daily
- Increase `ANALYZE_BATCH_SIZE` from 10 to 50+
- Add retry logic for failed pipeline steps

**Trigger:** When staleness is a real daily problem, or when showing to others as a live product.

---

### Tier 3 — Future: Platform Migration (Railway / Render / Fly.io)
**Unlocks:** True background workers, event-driven ingest, real-time processing, no timeout limits.

**Changes needed:**
- Separate worker process for pipeline (not serverless)
- Queue system (BullMQ or pg-based) for article analysis
- Swap pgbouncer URL for direct DB connection in workers
- WebSocket support for live dashboard updates

**Trigger:** Multiple users, real-time requirements, or SignalDesk becomes a paid product.

---

## Roadmap

### Now — Polish on Hobby Plan
- [x] SPEC.md + slim README to setup-only
- [ ] Surface "last pipeline run" timestamp in Intelligence UI
- [ ] Audit and expand RSS feed sources
- [ ] Improve Weekly Brief prompt quality

### Infra Decision Point
> **Decide: stay Hobby (free) or upgrade to Pro ($20/mo)?**

**If staying Hobby — more signals:**
- [ ] Add Healthcare composite signal (data partially exists)
- [ ] Add Macro/Fed sentiment signal
- [ ] Signal explanation UI (what does this signal mean, why does it move?)

**If upgrading to Pro — freshness:**
- [ ] Hourly cron, daily Part 2
- [ ] Increase analysis batch size
- [ ] Add retry logic

### Later — Product Expansion
- [ ] User auth (replace password cookie with proper session)
- [ ] Alert system: notify when signal crosses threshold (email or Slack)
- [ ] Signal history browser
- [ ] API for signal data (if productizing)
- [ ] Multi-user support (if productizing)

---

## Design Principles

1. **Spec before code.** Update this document before starting a feature. If you can't describe it here clearly, you're not ready to build it.

2. **Infra constraints are design inputs.** Design around the Hobby plan. Upgrade when a specific constraint becomes a real blocker — not before.

3. **Signal quality over quantity.** Two well-backtested signals beat ten noisy ones. Backtest before shipping a new signal.

4. **One pipeline, one cron.** The single `run-all` orchestrator is a feature — simple and debuggable. Don't split it until Tier 2.

5. **Data scientist advantage.** The ML pipeline is this product's moat. Invest here. The TypeScript/Next.js plumbing is commodity.
