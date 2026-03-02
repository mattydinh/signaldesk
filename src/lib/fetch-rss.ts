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
    const res = await fetch(feed.url, { cache: "no-store" });
    if (!res.ok) {
      console.error("[fetch-rss] feed failed", feed.url, res.status);
      return [];
    }
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = normalizeItems(parsed);

    const articles: IngestArticle[] = [];
    for (const item of items) {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) continue;
      const link = getLink(item);
      const summary = getSummary(item);
      const published =
        item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? undefined;
      const publishedAt = toIsoDate(published);
      articles.push({
        externalId: link ?? undefined,
        sourceName: feed.sourceName,
        sourceSlug: slugify(feed.sourceName),
        sourceBaseUrl: feed.sourceBaseUrl,
        title,
        summary: summary ?? undefined,
        url: link ?? undefined,
        publishedAt,
        rawPayload: item,
      });
    }
    return articles;
  } catch (e) {
    console.error("[fetch-rss] error", feed.url, e);
    return [];
  }
}

export async function fetchAllRssArticles(): Promise<IngestArticle[]> {
  const feeds = getRssFeeds();
  const all: IngestArticle[] = [];

  for (const feed of feeds) {
    const items = await fetchRssFeed(feed);
    all.push(...items);
  }

  // URL-first dedupe across all feeds.
  const seen = new Set<string>();
  const deduped: IngestArticle[] = [];

  for (const a of all) {
    if (!a.title) continue;
    const urlKey = typeof a.url === "string" && a.url.trim().length > 0 ? a.url.trim() : null;
    const titleKey = `${a.sourceSlug ?? slugify(a.sourceName)}|${a.title
      .trim()
      .toLowerCase()
      .slice(0, 200)}|${a.publishedAt ? a.publishedAt.slice(0, 10) : ""}`;
    const dedupeKey = (urlKey ?? titleKey).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(a);
  }

  return deduped;
}

