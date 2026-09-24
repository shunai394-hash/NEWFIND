import {
  getGoogleTrendsForWorld,
  type GoogleTrend,
} from "@/lib/ai/google-trends";

import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

const DEFAULT_GEOS = ["JP", "US", "GB"];

function languageForGeo(geo: string): string {
  return geo === "JP" ? "ja" : "en";
}

function toItem(
  trend: GoogleTrend,
  index: number,
): WorldSourceItem | null {
  const title = trend.title.trim();
  const geo = trend.geo.trim().toUpperCase();

  if (!title || !geo) return null;

  const sourceRef = `google-trends:${geo}:${title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 160)}`;

  return {
    title,
    url:
      trend.link?.trim() ||
      `https://trends.google.com/trending?geo=${encodeURIComponent(geo)}`,
    snippet: [
      trend.traffic ? `Approx. traffic: ${trend.traffic}` : null,
      trend.relatedQueries.length > 0
        ? `Related: ${trend.relatedQueries.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
    sourceType: "other",
    domain: "trends.google.com",
    language: languageForGeo(geo),
    sourceCountry: geo,
    publishedAt: trend.publishedAt,
    sourceRole: "news",
    origin: "web",
    rawContent: trend.title,
    sourceReliability: "official",
    retrievedAt: new Date().toISOString(),
    sourceName: "google_trends",
    sourceRef,
    signalType: "demand",
    metadata: {
      source: "google_trends_rss",
      geo,
      traffic: trend.traffic,
      relatedQueries: trend.relatedQueries,
      rank: index + 1,
    },
  };
}

export const googleTrendsWorldSourceCollector: WorldSourceCollector = {
  source: "google_trends",

  async collect(context = {}) {
    const limit = Math.min(
      Math.max(context.limit ?? 20, 1),
      50,
    );

    const geos = context.country?.trim()
      ? [context.country.trim().toUpperCase()]
      : DEFAULT_GEOS;

    const perGeo = Math.max(
      1,
      Math.ceil(limit / geos.length),
    );

    const trends = await getGoogleTrendsForWorld(
      geos,
      perGeo,
    );

    const items = trends
      .map((trend, index) => toItem(trend, index))
      .filter(
        (item): item is WorldSourceItem => Boolean(item),
      );

    const seen = new Set<string>();

    return items
      .filter((item) => {
        const key = `${item.sourceCountry}:${item.title
          .trim()
          .toLowerCase()}`;

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, limit);
  },
};
