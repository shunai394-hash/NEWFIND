import type {
  Marketplace,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from "../types";
import type { MarketplaceAdapter } from "./common";
import { defaultFetch } from "./common";
import { createAmazonAdapter } from "./amazon";
import { createEbayAdapter } from "./ebay";
import { createMercariAdapter } from "./mercari";
import { createYahooAuctionAdapter } from "./yahoo-auction";

export type AdapterRegistry = Record<Marketplace, MarketplaceAdapter>;

export function createMarketplaceAdapters(
  fetchImpl = defaultFetch(),
): AdapterRegistry {
  return {
    yahoo_auction: createYahooAuctionAdapter(fetchImpl),
    mercari: createMercariAdapter(fetchImpl),
    amazon: createAmazonAdapter(fetchImpl),
    ebay: createEbayAdapter(fetchImpl),
  };
}

export function marketplaceAdapterStatus(registry: AdapterRegistry) {
  return (Object.keys(registry) as Marketplace[]).map(
    (key) => registry[key].status(),
  );
}

export async function searchMarketplace(
  registry: AdapterRegistry,
  input: MarketplaceSearchQuery,
): Promise<MarketplaceSearchResult> {
  return registry[input.marketplace].search(input);
}

export type { MarketplaceAdapter };
