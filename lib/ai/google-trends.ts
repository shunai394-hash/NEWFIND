export type GoogleTrend = {
  title: string;
  traffic: string | null;
  publishedAt: string | null;
  relatedQueries: string[];
  link: string | null;
};

const RSS_CACHE = new Map<string, { at: number; items: GoogleTrend[] }>();
const RSS_TTL_MS = 15 * 60 * 1000;

function rssUrl(geo: string) {
  const code = geo.trim().toUpperCase() || "JP";
  return `https://trends.google.com/trending/rss?geo=${encodeURIComponent(code)}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  );

  return match ? decodeXml(match[1].trim()) : null;
}

function extractItems(xml: string): string[] {
  return xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
}

function extractAllTags(xml: string, tag: string): string[] {
  return [...xml.matchAll(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"),
  )].map((match) => decodeXml(match[1].trim()));
}

export async function getGoogleTrends(
  limit = 30,
  geo = "JP",
): Promise<GoogleTrend[]> {
  const cached = RSS_CACHE.get(geo);
  if (cached && Date.now() - cached.at < RSS_TTL_MS) {
    return cached.items.slice(0, limit);
  }
  try {
    const response = await fetch(rssUrl(geo), {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "NEWFIND/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `[Google Trends] RSS request failed: ${response.status}`,
      );
      return [];
    }

    const xml = await response.text();
    const items = extractItems(xml);

    const parsed = items.map((item) => ({
      title: extractTag(item, "title") ?? "",
      traffic:
        extractTag(item, "ht:approx_traffic") ??
        extractTag(item, "approx_traffic"),
      publishedAt: extractTag(item, "pubDate"),
      relatedQueries: extractAllTags(item, "ht:news_item_title"),
      link: extractTag(item, "link"),
    }));
    RSS_CACHE.set(geo, { at: Date.now(), items: parsed });
    return parsed.slice(0, limit);
  } catch (error) {
    console.error("[Google Trends] RSS fetch failed:", error);
    return [];
  }
}

export async function getGoogleTrendsForWorld(
  geos = ["JP", "US", "GB"],
  perGeo = 8,
): Promise<GoogleTrend[]> {
  const groups = await Promise.all(
    geos.map((geo) => getGoogleTrends(perGeo, geo)),
  );
  const unique = new Map<string, GoogleTrend>();
  for (const group of groups) {
    for (const item of group) {
      const key = item.title.trim().toLowerCase();
      if (!key || unique.has(key)) continue;
      unique.set(key, item);
    }
  }
  return [...unique.values()].slice(0, perGeo * geos.length);
}
