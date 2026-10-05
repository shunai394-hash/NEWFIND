import type { WorldSourceCollector, WorldSourceItem } from "./types";

type FeedSource = {
  name: string;
  url: string;
  focus: "robotics" | "ai" | "computing" | "research";
};

type FeedEntry = {
  title: string;
  link: string;
  description: string;
  publishedAt: string | null;
};

export const FUTURE_TECH_FEEDS: FeedSource[] = [
  { name: "MIT News — Artificial Intelligence", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", focus: "ai" },
  { name: "The Robot Report", url: "https://www.therobotreport.com/feed/", focus: "robotics" },
  { name: "IEEE Spectrum — Robotics", url: "https://spectrum.ieee.org/feeds/topic/robotics.rss", focus: "robotics" },
  { name: "IEEE Spectrum — Computing", url: "https://spectrum.ieee.org/feeds/topic/computing.rss", focus: "computing" },
  { name: "Google Research", url: "https://blog.research.google/feeds/posts/default?alt=rss", focus: "research" },
  { name: "TechCrunch — AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", focus: "ai" },
  { name: "NASA Technology", url: "https://www.nasa.gov/feed/", focus: "research" },
  { name: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", focus: "computing" },
];

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function tagValue(block: string, tag: string): string {
  const pattern = "<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">";
  const match = block.match(new RegExp(pattern, "i"));
  return decodeXml(match?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFutureTechFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  const entries: FeedEntry[] = [];

  for (const block of blocks) {
    const title = tagValue(block, "title");
    const linkTag = block.match(/<link\b([^>]*)>([\s\S]*?)<\/link>/i);
    const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
    const link = decodeXml((href || linkTag?.[2] || "").trim());
    const description =
      tagValue(block, "description") ||
      tagValue(block, "summary") ||
      tagValue(block, "content");
    const publishedAt =
      tagValue(block, "pubDate") ||
      tagValue(block, "published") ||
      tagValue(block, "updated");

    if (!title || !link || !description) continue;
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) continue;
      entries.push({
        title,
        link: parsed.toString(),
        description: description.slice(0, 1800),
        publishedAt: publishedAt || null,
      });
    } catch {
      // Malformed feed entries are discarded; other entries remain usable.
    }
  }

  return entries;
}

async function collectFeed(source: FeedSource, limit: number): Promise<WorldSourceItem[]> {
  const response = await fetch(source.url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "User-Agent": "NEWFIND-Future-Tech-Desk/1.0",
    },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(source.name + " returned HTTP " + response.status);

  const entries = parseFutureTechFeed(await response.text());
  return entries.slice(0, limit).map((entry) => {
    let domain = "";
    try {
      domain = new URL(entry.link).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      // parseFutureTechFeed already rejects malformed URLs.
    }
    return {
      title: entry.title,
      url: entry.link,
      snippet: entry.description,
      sourceType: "news" as const,
      domain,
      language: "en",
      publishedAt: entry.publishedAt,
      sourceRole: "news" as const,
      origin: "web" as const,
      rawContent: entry.description,
      sourceReliability: "publisher_feed",
      retrievedAt: new Date().toISOString(),
      classificationReason: "future-tech-feed:" + source.focus,
      sourceName: "future_tech_news" as const,
      sourceRef: entry.link,
      signalType: "technology" as const,
      metadata: { feed: source.name, focus: source.focus },
    };
  });
}

/**
 * Collect independent reporting and lab updates for the future-tech desk.
 * Each feed is isolated so a single publisher outage never blocks the others.
 */
export async function collectFutureTechNews(limit = 4): Promise<WorldSourceItem[]> {
  const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 8);
  const results = await Promise.allSettled(
    FUTURE_TECH_FEEDS.map((source) => collectFeed(source, boundedLimit)),
  );
  const seen = new Set<string>();
  const items: WorldSourceItem[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[Future Tech Desk] feed unavailable:", result.reason);
      continue;
    }
    for (const item of result.value) {
      const key = item.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  return items
    .sort((a, b) => {
      const aDate = Date.parse(a.publishedAt || "") || 0;
      const bDate = Date.parse(b.publishedAt || "") || 0;
      return bDate - aDate;
    })
    .slice(0, boundedLimit * 3);
}


/** Official lab updates and independent technology reporting for the future-tech desk. */
export const futureTechNewsWorldSourceCollector: WorldSourceCollector = {
  source: "future_tech_news",
  collect(context = {}) {
    return collectFutureTechNews(context.limit ?? 8);
  },
};
