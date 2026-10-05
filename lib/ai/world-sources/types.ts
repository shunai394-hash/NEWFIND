import type { WorldSearchResult } from "@/lib/ai/world-search";
import { canonicalizeSourceUrl } from "@/lib/ai/agent-os/hash";

export type WorldSourceName =
  | "product_hunt"
  | "hugging_face"
  | "github"
  | "arxiv"
  | "nasa"
  | "kickstarter"
  | "indiegogo"
  | "google_trends"
  | "future_tech_news";

export type WorldSourceItem = WorldSearchResult & {
  sourceName: WorldSourceName;
  sourceRef: string;
  signalType:
    | "product"
    | "service"
    | "model"
    | "space"
    | "software"
    | "research"
    | "hardware"
    | "crowdfunding"
    | "demand"
    | "science"
    | "technology";
  metadata?: Record<string, unknown>;
};

export type WorldSourceCollectorContext = {
  limit?: number;
  country?: string;
  language?: string;
};

export interface WorldSourceCollector {
  readonly source: WorldSourceName;
  collect(
    context?: WorldSourceCollectorContext,
  ): Promise<WorldSourceItem[]>;
}

export function normalizeWorldSourceItem(
  item: WorldSourceItem,
): WorldSourceItem {
  return {
    ...item,
    title: item.title.trim(),
    url: item.url.trim(),
    snippet: item.snippet.trim().slice(0, 2000),
    domain: item.domain.trim().toLowerCase(),
    sourceRef: item.sourceRef.trim(),
    retrievedAt: item.retrievedAt ?? new Date().toISOString(),
  };
}

export function dedupeWorldSourceItems(
  items: WorldSourceItem[],
): WorldSourceItem[] {
  const seen = new Set<string>();
  const result: WorldSourceItem[] = [];

  for (const rawItem of items) {
    const item = normalizeWorldSourceItem(rawItem);
    let key = "";

    // The URL identifies the actual article/release/product and can dedupe a
    // syndicated story across collectors. sourceRef may be a non-URL ID (e.g.
    // an arXiv id), so it is only the fallback when the item URL is invalid.
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        key = `url:${canonicalizeSourceUrl(item.url)}`;
      }
    } catch {
      // Use the source-specific reference below for non-URL items.
    }
    if (!key) key = `${item.sourceName}:${item.sourceRef || item.url}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function sourceUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function sourceKind(
  signalType: WorldSourceItem["signalType"],
): WorldSearchResult["sourceType"] {
  switch (signalType) {
    case "research":
      return "editorial";
    case "science":
    case "space":
      return "official_person";
    default:
      return "other";
  }
}
