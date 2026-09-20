import type {
  AdapterFetch,
  AdapterStatus,
  Marketplace,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
  MarketplaceSourceType,
} from "../types";

export type MarketplaceAdapter = {
  marketplace: Marketplace;
  status(): AdapterStatus;
  search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult>;
};

export function disabledResult(
  marketplace: Marketplace,
  query: string,
  reason: string,
  sourceType: MarketplaceSourceType = "unknown",
): MarketplaceSearchResult {
  return {
    status: { marketplace, enabled: false, reason, sourceType },
    query,
    candidates: [],
    fetchedAt: new Date().toISOString(),
    unavailableReason: reason,
  };
}

export function emptyEnabledResult(
  marketplace: Marketplace,
  query: string,
  sourceType: MarketplaceSourceType,
): MarketplaceSearchResult {
  return {
    status: { marketplace, enabled: true, reason: null, sourceType },
    query,
    candidates: [],
    fetchedAt: new Date().toISOString(),
    unavailableReason: null,
  };
}

export function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function defaultFetch(): AdapterFetch {
  return (url, init) =>
    fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function hostOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
