export type RssFeedConfig = {
  url: string;
  sourceName: string;
  sourceBaseUrl?: string;
};

// Default curated RSS sources across finance, geopolitics, energy, healthcare, and tech.
const defaultFeeds: RssFeedConfig[] = [
  // Markets / Finance
  {
    url: "https://feeds.npr.org/1006/rss.xml",
    sourceName: "NPR Business",
    sourceBaseUrl: "https://www.npr.org",
  },
  {
    url: "https://reutersbest.com/feed/",
    sourceName: "Reuters Best",
    sourceBaseUrl: "https://reutersbest.com",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    sourceName: "MarketWatch Top Stories",
    sourceBaseUrl: "https://www.marketwatch.com",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",
    sourceName: "MarketWatch Headlines",
    sourceBaseUrl: "https://www.marketwatch.com",
  },
  {
    url: "https://rss.cnn.com/rss/money_latest.rss",
    sourceName: "CNN Business",
    sourceBaseUrl: "https://www.cnn.com",
  },
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    sourceName: "CNBC Top News",
    sourceBaseUrl: "https://www.cnbc.com",
  },
  {
    url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",
    sourceName: "Yahoo Finance",
    sourceBaseUrl: "https://finance.yahoo.com",
  },
  {
    url: "https://feeds.bloomberg.com/markets/news.rss",
    sourceName: "Bloomberg Markets",
    sourceBaseUrl: "https://www.bloomberg.com",
  },

  // Geopolitics / Political
  {
    url: "https://apnews.com/rss/apf-topnews",
    sourceName: "AP News",
    sourceBaseUrl: "https://apnews.com",
  },
  {
    url: "https://feeds.npr.org/1004/rss.xml",
    sourceName: "NPR World",
    sourceBaseUrl: "https://www.npr.org",
  },
  {
    url: "http://feeds.bbci.co.uk/news/world/rss.xml",
    sourceName: "BBC World",
    sourceBaseUrl: "https://www.bbc.com",
  },

  // Energy / Oil
  {
    url: "https://www.eia.gov/rss/news.xml",
    sourceName: "EIA Energy News",
    sourceBaseUrl: "https://www.eia.gov",
  },
  {
    url: "https://oilprice.com/rss/main",
    sourceName: "OilPrice.com",
    sourceBaseUrl: "https://oilprice.com",
  },

  // Healthcare / Pharma
  {
    url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases",
    sourceName: "FDA Press Releases",
    sourceBaseUrl: "https://www.fda.gov",
  },
  {
    url: "https://feeds.npr.org/1128/rss.xml",
    sourceName: "NPR Health",
    sourceBaseUrl: "https://www.npr.org",
  },

  // Tech
  {
    url: "https://www.theverge.com/rss/index.xml",
    sourceName: "The Verge",
    sourceBaseUrl: "https://www.theverge.com",
  },
  {
    url: "https://feeds.arstechnica.com/arstechnica/index",
    sourceName: "Ars Technica",
    sourceBaseUrl: "https://arstechnica.com",
  },
  {
    url: "https://techcrunch.com/feed/",
    sourceName: "TechCrunch",
    sourceBaseUrl: "https://techcrunch.com",
  },
];

/**
 * Returns the list of RSS feeds to ingest.
 *
 * Override via RSS_FEEDS to provide a comma-separated list of URLs, or a JSON
 * string of [{ url, sourceName, sourceBaseUrl? }].
 */
export function getRssFeeds(): RssFeedConfig[] {
  const override = process.env.RSS_FEEDS;
  if (!override || !override.trim()) return defaultFeeds;

  const raw = override.trim();

  // JSON override: RSS_FEEDS='[{"url":"...","sourceName":"..."}, ...]'
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<RssFeedConfig>> | Partial<RssFeedConfig>;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const cleaned = arr
        .filter((f): f is RssFeedConfig => typeof f?.url === "string" && typeof f?.sourceName === "string")
        .map((f) => ({
          url: f.url!,
          sourceName: f.sourceName!,
          sourceBaseUrl: f.sourceBaseUrl,
        }));
      if (cleaned.length > 0) return cleaned;
    } catch {
      // Fall through to CSV parsing.
    }
  }

  // CSV override: RSS_FEEDS="https://feed1,https://feed2"
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return defaultFeeds;

  return parts.map<RssFeedConfig>((url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, "");
      const name = host
        .split(".")
        .slice(0, -1)
        .join(".")
        .replace(/\./g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) || host;
      return {
        url,
        sourceName: name,
        sourceBaseUrl: `${u.protocol}//${u.host}`,
      };
    } catch {
      return {
        url,
        sourceName: url,
      };
    }
  });
}

