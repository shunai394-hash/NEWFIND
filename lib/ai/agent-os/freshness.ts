import { canonicalizeSourceUrl } from "./hash";

/** News-like sources older than this are not treated as new discoveries. */
export const NEWS_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export type SourceFreshness = "fresh" | "duplicate" | "stale";

const NEWS_TYPES = new Set(["news", "magazine", "editorial", "sns", "blog"]);

export function assessSourceFreshness(input: {
  sourceUrl: string;
  sourceType?: string | null;
  publishedAt?: string | null;
  recentSourceUrls: string[];
  now?: number;
}): SourceFreshness {
  const url = canonicalizeSourceUrl(input.sourceUrl);
  if (!url) return "stale";
  const seen = input.recentSourceUrls.some(
    (item) => canonicalizeSourceUrl(item) === url,
  );
  if (seen) return "duplicate";

  const published = input.publishedAt ? Date.parse(input.publishedAt) : NaN;
  if (
    NEWS_TYPES.has((input.sourceType || "").toLowerCase()) &&
    Number.isFinite(published)
  ) {
    const age = (input.now ?? Date.now()) - published;
    if (age > NEWS_STALE_MS) return "stale";
  }
  return "fresh";
}

export function filterFreshSources<
  T extends {
    url: string;
    sourceType?: string | null;
    publishedAt?: string | null;
  },
>(results: T[], recentSourceUrls: string[]) {
  const fresh: T[] = [];
  const skipped: Array<{ item: T; freshness: SourceFreshness }> = [];
  for (const item of results) {
    const freshness = assessSourceFreshness({
      sourceUrl: item.url,
      sourceType: item.sourceType,
      publishedAt: item.publishedAt,
      recentSourceUrls,
    });
    if (freshness === "fresh") fresh.push(item);
    else skipped.push({ item, freshness });
  }
  return { fresh, skipped };
}
