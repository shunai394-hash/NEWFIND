import type { WorldSearchResult } from "@/lib/ai/world-search";

export type WorldSourceName =
  | "product_hunt"
  | "hugging_face"
  | "github"
  | "arxiv"
  | "nasa"
  | "kickstarter"
  | "indiegogo"
  | "google_trends";

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

  for (const item of items) {
    const key =
      item.sourceRef ||
      `${item.sourceName}:${item.url}`.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalizeWorldSourceItem(item));
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
