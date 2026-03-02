// One-off: fetch RSS feeds, print first 5 by publishedAt (before any dedup). No Prisma.
import { XMLParser } from "fast-xml-parser";

const FEEDS = [
  { url: "https://reutersbest.com/feed/", name: "Reuters Best" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", name: "MarketWatch" },
  { url: "https://rss.cnn.com/rss/money_latest.rss", name: "CNN Business" },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "CNBC" },
  { url: "https://apnews.com/rss/apf-topnews", name: "AP News" },
];

const parser = new XMLParser();
const all = [];

for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, { cache: "no-store" });
    if (!res.ok) continue;
    const xml = await res.text();
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel ?? parsed?.feed ?? parsed?.channel;
    const rawItems = channel?.item ?? channel?.entry ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];
    for (const it of items) {
      const pub = it.pubDate ?? it.published ?? it.updated ?? it["dc:date"];
      const title = (typeof it.title === "string" ? it.title : "")?.trim();
      if (!pub) continue;
      const date = new Date(pub);
      const iso = isNaN(date.getTime()) ? pub : date.toISOString();
      all.push({ publishedAt: iso, title: title?.slice(0, 60) ?? "", source: f.name });
    }
  } catch (e) {
    console.error(f.name, e.message);
  }
}

const sorted = all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const first5 = sorted.slice(0, 5);

console.log("First 5 by publishedAt (before dedup):");
first5.forEach((a, i) => console.log(`${i + 1}. ${a.publishedAt}  ${a.source}  ${a.title}`));
