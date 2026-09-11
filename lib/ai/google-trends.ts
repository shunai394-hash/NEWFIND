export type GoogleTrend = {
  title: string;
  traffic: string | null;
  publishedAt: string | null;
  relatedQueries: string[];
  link: string | null;
};

const GOOGLE_TRENDS_RSS_URL =
  "https://trends.google.com/trending/rss?geo=JP";

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
): Promise<GoogleTrend[]> {
  try {
    const response = await fetch(GOOGLE_TRENDS_RSS_URL, {
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

    return items.slice(0, limit).map((item) => ({
      title: extractTag(item, "title") ?? "",
      traffic:
        extractTag(item, "ht:approx_traffic") ??
        extractTag(item, "approx_traffic"),
      publishedAt: extractTag(item, "pubDate"),
      relatedQueries: extractAllTags(item, "ht:news_item_title"),
      link: extractTag(item, "link"),
    }));
  } catch (error) {
    console.error("[Google Trends] RSS fetch failed:", error);
    return [];
  }
}
