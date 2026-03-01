# Data sources and categories for investors

## Article categories (taxonomy)

Articles are tagged with 1–3 categories at analysis time. The AI chooses from this list:

| Category | Description |
|----------|-------------|
| Finance | Banking, M&A, earnings, corporate finance |
| Crypto | Digital assets, blockchain, DeFi, exchanges |
| Political | Elections, policy, domestic politics |
| Geopolitics | International relations, sanctions, alliances |
| War & Conflict | Armed conflict, military, security |
| Technology | Software, hardware, platforms, innovation |
| Entertainment | Gaming, video games, film, TV, streaming, media |
| Regulation | Laws, regulators, compliance |
| Markets | Equities, bonds, commodities, trading |
| Energy | Oil, gas, renewables, utilities |
| Healthcare | Pharma, biotech, providers |
| Other | Anything that doesn’t fit above |

- **Where it’s defined:** `src/lib/categories.ts` (`ARTICLE_CATEGORIES`).
- **Where it’s applied:** Analyze API uses it in the system prompt; dashboard filter and article cards use the same list.
- **Filtering:** Dashboard “Category” dropdown and list/API support a single `category` filter (articles that have that tag).

## Adding more data sources

The app currently ingests headlines from **News API** (sources you configure). To better serve investors, you can add:

1. **News API “everything” or custom queries**  
   Use the same News API key with different endpoints or query terms (e.g. tickers, “earnings”, “SEC”, “Fed”) and run them through the same ingest → Blob/Supabase → analyze pipeline so they get categories and implications.

2. **RSS / custom feeds**  
   Add a small fetcher that turns RSS items into the same `IngestArticleInput` shape and calls the existing ingest API. All articles then get analysis and categories.

3. **Financial/market data APIs** (for context, not replacing news)  
   - **Alpha Vantage** – fundamentals, quotes, earnings.  
   - **Finnhub** – real-time quotes, company news, filings.  
   - **Polygon** – stocks, options, forex.  
   Use these to enrich *context* (e.g. “earnings date”, “sector”) or to trigger “fetch news for this ticker” rather than storing full market data in the same table as news.

4. **SEC / regulatory**  
   RSS or APIs for 10-K/10-Q, 8-K, or EDGAR full-text search. Ingest as “articles” with a dedicated source (e.g. “SEC Filings”) so they get the same analysis and categories (e.g. Regulation, Finance).

5. **Social / alternative**  
   Twitter/X or Reddit APIs (with rate limits and ToS in mind) can be ingested as another source type; same pipeline gives categories and investor implications.

**Recommendation:** Keep one ingest format and one analysis pipeline. Add new *sources* (News API queries, RSS, SEC, etc.) that produce the same article shape; then categories and investor summaries stay consistent and you can filter by category across all sources.
