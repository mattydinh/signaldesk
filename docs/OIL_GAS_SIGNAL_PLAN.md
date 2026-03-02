# Oil & Gas Signal — Assessment & Implementation Plan

Based on [OIL_GAS_SIGNAL_SPEC.md](OIL_GAS_SIGNAL_SPEC.md) and the current SignalDesk pipeline.

---

## Assessment

**What’s strong about the spec**

- **Aligns with existing design** — Same pattern as current signals: rolling 60d z-scores, clip ±3, no lookahead. Reuses `daily_topic_metrics`, `derived_signals`, `market_prices`, `backtest_results`. Fits the pipeline mentally and technically.
- **Clear feature set** — Five components (price momentum, sentiment, volume, inventory, rig) plus composite and optional regime flag. Weights and formulas are explicit.
- **Backtest and UI** — Option A (threshold) matches our current backtest; metrics (Sharpe, max DD, hit rate) already exist on `BacktestResult`. Intelligence page additions (gauge, table, chart) are scoped and implementable.
- **Energy already in the stack** — `ARTICLE_CATEGORIES` includes "Energy"; keyword inference has oil/gas/OPEC. We do **not** yet have Energy in `SIGNAL_DEFS` in `derived-signals.ts` (we have Geopolitics, Regulation, Markets, Finance, Technology, War & Conflict). Adding `EnergySentiment` and an Energy volume signal is a small extension.

**What’s new / needs work**

1. **Market prices** — We currently fetch SPY, QQQ, XLK, XLF, VNQ, GLD, USO. We have USO (oil ETF). We need **XLE** and a **WTI proxy** (e.g. CL=F on Yahoo, or keep using USO). Add XLE (and optionally CL=F) to `market-prices.ts` ticker list.
2. **EIA and Baker Hughes** — Not in the app today. We need:
   - A place to store weekly fundamentals (new table or reuse). A small `weekly_fundamentals` or `oil_fundamentals` table keyed by (series, date) is enough.
   - Cron or serverless job to fetch EIA inventory change and Baker Hughes rig count (APIs or scrapes). EIA has a public API; Baker Hughes often requires a source (e.g. their report or a data vendor).
   - Forward-fill to daily when building the oil signals (same calendar as `derived_signals`).
3. **New pipeline step(s)** — Today we have: event_features → daily_topic_metrics → derived_signals → market_prices → regime → backtest. For oil we need:
   - **Energy (and optionally oil-keyword) signals** from `daily_topic_metrics`: add `EnergySentiment` and `OilNewsVolume` (Energy volume z) to `SIGNAL_DEFS`, **or** a dedicated small step that reads Energy topic + optional Markets/Finance oil filter and writes the same names.
   - **Oil-specific inputs**: WTI 30d momentum, EIA inventory change, rig 4w change — these are not in `daily_topic_metrics`. So either:
     - A new step that reads `market_prices` (WTI/USO), reads weekly fundamentals (EIA, rig), computes z-scores and writes `OilPriceMomentum`, `InventoryShock`, `RigTrend` to `derived_signals`; then a second step (or same step) that computes the weighted composite and writes `OilCompositeSignal`; or
     - One “oil signals” module that does all of the above and writes the six signal names to `derived_signals`.
4. **Backtest** — We already have `runBacktest(signalName, ticker)`. Add calls for OilCompositeSignal vs WTI proxy, XLE, and SPY (and optionally 1y/3y/5y windows). BacktestResult already has the required fields.
5. **Intelligence UI** — New “Oil & Gas” section: gauge (-3 to +3), component table, dual-axis chart (signal vs WTI/XLE/SPY), backtest summary panel. Requires fetching the new signals and possibly new API routes or server components that aggregate oil backtest results.

**Risks / open decisions**

- **EIA / Baker Hughes availability** — Confirm API keys, rate limits, and that we can run a weekly (or daily) job to pull data. If we can’t get rig count easily, we can ship with InventoryShock only and set RigTrend weight to 0 or omit it initially.
- **WTI symbol** — Yahoo often uses `CL=F` for front-month; verify and add fallback to USO if needed.
- **Scope for “tomorrow”** — Full spec in one day is a lot. Phasing (see below) keeps the first milestone shippable without EIA/rig if needed.

---

## Phased Implementation Plan (for tomorrow and follow-ups)

### Phase 1 — Foundation (no EIA/rig yet)

**Goal:** Oil composite using only price momentum + NLP (Energy sentiment + volume). Backtest vs USO/XLE/SPY. Visible on Intelligence.

1. **Market prices**  
   - Add **XLE** (and optionally **CL=F**) to `TICKERS` in [src/lib/pipeline/market-prices.ts](src/lib/pipeline/market-prices.ts).  
   - Keep USO as fallback for “WTI proxy” if CL=F fails.

2. **Energy NLP signals**  
   - In [src/lib/pipeline/derived-signals.ts](src/lib/pipeline/derived-signals.ts), add to `SIGNAL_DEFS`:
     - `EnergySentiment` (topic Energy, useSentiment: true)
     - `OilNewsVolume` (topic Energy, useVolume: true)  
   - So we get Energy sentiment and Energy volume z-scores from existing `daily_topic_metrics` (no new tables).

3. **Oil momentum signal**  
   - New module e.g. `src/lib/pipeline/oil-signals.ts` (or under `pipeline/`):
     - Read `market_prices` for WTI proxy (CL=F or USO): 30d return, then rolling 60d z-score, clip ±3 → write `OilPriceMomentum` to `derived_signals`.
   - No EIA/rig in this phase; `InventoryShock` and `RigTrend` can be omitted or written as 0.

4. **Composite (3 components)**  
   - In the same module: compute  
     `OilCompositeSignal_raw = 0.35 * OilPriceMomentum_z + 0.25 * EnergySentiment_z + 0.15 * OilNewsVolume_z`  
     (re-normalize to z and clip ±3), then upsert `OilCompositeSignal` into `derived_signals`.

5. **Pipeline wiring**  
   - In [src/lib/pipeline/run.ts](src/lib/pipeline/run.ts): after `runDerivedSignals`, call the new oil step (momentum + composite). After `runMarketPrices`, run backtests for `OilCompositeSignal` vs USO, XLE, SPY (e.g. 90d or 1y for tomorrow).

6. **Intelligence page**  
   - Add an “Oil & Gas” block:  
     - Latest `OilCompositeSignal` z-score with a simple gauge (-3 to +3) and labels (Strong Bearish … Strong Bullish).  
     - Table of component z-scores (OilPriceMomentum, EnergySentiment, OilNewsVolume; leave Inventory/Rig as “—” for now).  
     - One chart: OilCompositeSignal_z vs WTI (or USO) price (dual-axis).  
     - Backtest summary for OilCompositeSignal vs USO and XLE (Sharpe, max DD, ann. return, hit rate) from `backtest_results`.

**Deliverable:** Oil composite live on Intelligence using price + Energy NLP only; backtests stored and shown. No EIA/rig yet.

---

### Phase 2 — EIA & rig (when data is available)

7. **Storage for weekly fundamentals**  
   - Add table (e.g. `WeeklyFundamental`: series, date, value) or a small JSON/keyed store. Run migration or SQL script.

8. **EIA cron**  
   - Weekly job (e.g. after EIA release): fetch crude (and optionally gasoline) inventory change, persist. Forward-fill to daily in the oil-signals step.

9. **Rig count**  
   - Weekly job: fetch Baker Hughes rig count, store, compute 4w change, forward-fill to daily.

10. **Extend oil-signals step**  
    - Compute `InventoryShock_z` and `RigTrend_z` (with optional direction flip).  
    - Composite: add 0.15 * InventoryShock_z and 0.10 * RigTrend_z; re-normalize and clip.  
    - Write all six names to `derived_signals`.

11. **Intelligence**  
    - Show InventoryShock and RigTrend in the component table; keep same gauge/chart/backtest panel.

---

### Phase 3 — Optional regime and polish

12. **OilStressSignal**  
    - If desired: compute GeopoliticsVolume_z + OilNewsVolume_z; if &gt; 2, show “Energy Shock Risk” on Intelligence.

13. **Cron order**  
    - Align with spec: daily 6am (or after existing ingest) run market_prices → fundamentals update (if new) → daily_topic_metrics (already in part 1) → derived_signals → oil signals → backtests. Can be one cron or two (part 1 / part 2) to avoid timeout.

14. **Backtest windows**  
    - Add 1y, 3y, 5y options and persist separate BacktestResult rows (we already have startDate/endDate in the key).

---

## Suggested order for “tomorrow”

1. Add XLE (and CL=F or USO as WTI proxy) to market_prices; run pipeline and confirm rows.  
2. Add EnergySentiment and OilNewsVolume to SIGNAL_DEFS; run part 1 and confirm derived_signals.  
3. Implement `oil-signals.ts`: OilPriceMomentum from price, 3-component composite, write to derived_signals.  
4. Wire oil step and OilCompositeSignal backtests into run.ts (part 2).  
5. Add Oil & Gas section to Intelligence page (gauge, table, one chart, backtest panel).

That gives a working Oil composite and UI without blocking on EIA/rig. EIA and rig can follow in Phase 2 once data sources are confirmed.
