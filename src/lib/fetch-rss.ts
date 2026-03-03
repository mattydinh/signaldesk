import { type IngestArticle } from "@/lib/ingest";
import { getRssFeeds, type RssFeedConfig } from "./rss-sources";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toIsoDate(input: unknown): string | undefined {
  if (!input) return undefined;
  const s = String(input);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeItems(parsed: any): any[] {
  if (!parsed) return [];
  const channel = parsed.rss?.channel ?? parsed.feed ?? parsed.channel;
  if (!channel) return [];
  const items = (channel.item ?? channel.entry ?? []) as any;
  if (Array.isArray(items)) return items;
  return [items];
}

function getLink(item: any): string | undefined {
  if (!item) return undefined;
  if (typeof item.link === "string") return item.link;
  if (Array.isArray(item.link)) {
    const first = item.link[0];
    if (!first) return undefined;
    if (typeof first === "string") return first;
    if (typeof first.href === "string") return first.href;
  }
  if (item.link && typeof item.link.href === "string") return item.link.href;
  if (item.guid) {
    if (typeof item.guid === "string") return item.guid;
    if (typeof item.guid._ === "string") return item.guid._;
  }
  return undefined;
}

/** Normalize URL for use as externalId so same story with different params/fragment = one row. */
function normalizeArticleUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    const params = u.searchParams;
    // Strip common tracking params so same article URL from different feeds matches
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ref"]) {
      params.delete(key);
    }
    u.search = params.toString();
    return u.toString();
  } catch {
    return url.trim();
  }
}

/** True if URL looks like the feed itself or a generic RSS/section URL, not a per-article link. */
function isLikelyFeedOrSectionUrl(link: string, feedUrl: string): boolean {
  const s = link.toLowerCase();
  if (!s || s === feedUrl.toLowerCase()) return true;
  if (s.endsWith(".xml") || s.includes("/feed/") || s.includes("/rss") || s.includes("/rss/")) return true;
  try {
    const feed = new URL(feedUrl);
    const item = new URL(link);
    if (feed.origin === item.origin && item.pathname === feed.pathname) return true;
  } catch {
    // ignore
  }
  return false;
}

/** Stable unique id when we can't use link (missing, or feed URL). Prefer guid when it looks like a permalink. */
function fallbackExternalId(
  sourceSlug: string,
  title: string,
  publishedAt: string | undefined,
  guid: string | undefined,
  linkOrIndex?: string | number
): string {
  if (guid && typeof guid === "string" && guid.trim().length > 0) {
    const g = guid.trim();
    if (g.startsWith("http") && !g.includes("/feed") && !g.endsWith(".xml")) return normalizeArticleUrl(g);
  }
  const datePart = publishedAt ? publishedAt.slice(0, 10) : "";
  const key = `${sourceSlug}|${title.trim().toLowerCase().slice(0, 200)}|${datePart}|${linkOrIndex ?? ""}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return `gen:${sourceSlug}:${datePart}:${Math.abs(h).toString(36)}`;
}

function getSummary(item: any): string | undefined {
  if (!item) return undefined;
  return (
    (typeof item.description === "string" && item.description) ||
    (typeof item.summary === "string" && item.summary) ||
    (typeof item["content:encoded"] === "string" && item["content:encoded"]) ||
    undefined
  );
}

export async function fetchRssFeed(feed: RssFeedConfig): Promise<IngestArticle[]> {
  try {
    const res = await fetch(feed.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error("[fetch-rss] feed failed", feed.url, "status:", res.status);
      return [];
    }
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = normalizeItems(parsed);

    const sourceSlug = slugify(feed.sourceName);
    const articles: IngestArticle[] = [];
    const seenExternalIdsInFeed = new Set<string>();
    items.forEach((item, index) => {
      const rawTitle = item.title;
      const title = (
        typeof rawTitle === "string" ? rawTitle :
        typeof rawTitle?.["#text"] === "string" ? rawTitle["#text"] :
        ""
      ).trim();
      if (!title) return;
      const link = getLink(item);
      const guid =
        typeof item.guid === "string"
          ? item.guid
          : typeof item.guid?._ === "string"
            ? item.guid._
            : undefined;
      const published =
        item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? undefined;
      const publishedAt = toIsoDate(published);
      const useLinkAsId =
        link &&
        link.trim().length > 0 &&
        !isLikelyFeedOrSectionUrl(link, feed.url);
      // Include publishedAt in externalId so feeds that reuse URLs (update titles/dates, same URL)
      // produce distinct ids. Same URL + same date = dedup; same URL + different date = new article.
      const datePart = publishedAt ? publishedAt.slice(0, 10) : "";
      let externalId: string;
      if (useLinkAsId) {
        const normalized = normalizeArticleUrl(link!);
        const urlWithDate = datePart ? `${normalized}|${datePart}` : normalized;
        if (seenExternalIdsInFeed.has(urlWithDate)) {
          externalId = fallbackExternalId(sourceSlug, title, publishedAt, guid, index);
        } else {
          seenExternalIdsInFeed.add(urlWithDate);
          externalId = urlWithDate;
        }
      } else {
        externalId = fallbackExternalId(sourceSlug, title, publishedAt, guid, index);
      }
      articles.push({
        externalId,
        sourceName: feed.sourceName,
        sourceSlug,
        sourceBaseUrl: feed.sourceBaseUrl,
        title,
        summary: getSummary(item) ?? undefined,
        url: link ?? undefined,
        publishedAt,
        rawPayload: item,
      });
    });
    console.log("[fetch-rss] parsed", feed.sourceName, "items:", items.length, "articles:", articles.length);
    return articles;
  } catch (e) {
    console.error("[fetch-rss] error", feed.url, e);
    return [];
  }
}

export async function fetchAllRssArticles(): Promise<IngestArticle[]> {
  const feeds = getRssFeeds();

  // Fetch all feeds in parallel — sequential fetching with no timeout was causing 60s+ hangs
  const results = await Promise.allSettled(feeds.map((feed) => fetchRssFeed(feed)));
  const all: IngestArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") all.push(...result.value);
  }

  // Dedupe across feeds. Use url+date so feeds that reuse URLs for updated content
  // don't drop newer articles. Same URL + same date = syndication (keep one).
  const seen = new Set<string>();
  const deduped: IngestArticle[] = [];

  for (const a of all) {
    if (!a.title) continue;
    const datePart = a.publishedAt ? a.publishedAt.slice(0, 10) : "";
    const urlKey =
      typeof a.url === "string" && a.url.trim().length > 0
        ? (a.url.trim() + (datePart ? `|${datePart}` : "")).toLowerCase()
        : null;
    const titleKey = `${a.sourceSlug ?? slugify(a.sourceName)}|${a.title
      .trim()
      .toLowerCase()
      .slice(0, 200)}|${datePart}`;
    const dedupeKey = (urlKey ?? titleKey).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(a);
  }

  // Guarantee unique (sourceSlug, externalId) so ingest never skips new articles as "already in feed".
  console.log("[fetch-rss] after cross-feed dedup: all=", all.length, "deduped=", deduped.length);

  const seenKey = new Map<string, number>();
  for (const a of deduped) {
    const slug = a.sourceSlug ?? slugify(a.sourceName);
    const key = `${slug}:${a.externalId ?? ""}`;
    const count = (seenKey.get(key) ?? 0) + 1;
    seenKey.set(key, count);
    if (count > 1) {
      const stableSuffix = `#${count}-${(a.title + (a.url ?? "") + (a.publishedAt ?? "")).slice(0, 80).split("").reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0).toString(36)}`;
      a.externalId = (a.externalId ?? "gen") + stableSuffix;
    }
  }

  return deduped;
}

