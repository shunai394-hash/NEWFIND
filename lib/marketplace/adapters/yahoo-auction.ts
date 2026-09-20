import type {
  MarketplaceProductCandidate,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from "../types";
import type { MarketplaceAdapter } from "./common";
import {
  asNumber,
  asString,
  defaultFetch,
  disabledResult,
  emptyEnabledResult,
  env,
  isHttpUrl,
} from "./common";

function pickItem(raw: Record<string, unknown>): Record<string, unknown> {
  return (raw.Item ?? raw) as Record<string, unknown>;
}

function mapItem(
  raw: Record<string, unknown>,
  observedAt: string,
): MarketplaceProductCandidate | null {
  const item = pickItem(raw);
  const id = asString(item.AuctionID);
  const url = asString(item.AuctionItemUrl);
  const title = asString(item.Title);
  if (!id || !url || !title || !isHttpUrl(url)) return null;
  const seller = (item.Seller ?? {}) as Record<string, unknown>;
  const price = asNumber(item.CurrentPrice) ?? asNumber(item.Price);
  const imageUrl = asString(item.Image);
  const bids = asNumber(item.Bids);
  return {
    marketplace: "yahoo_auction",
    externalProductId: id,
    title,
    brand: null,
    category: asString(item.CategoryIdPath) ?? asString(item.CategoryId),
    url,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null,
    price,
    currency: "JPY",
    sellerName: asString(seller.Id) ?? asString(item.SellerId),
    sellerType: "marketplace_seller",
    availability: /closed|end/i.test(String(item.Status ?? ""))
      ? "ended"
      : "in_stock",
    observedAt,
    sourceType: "official_api",
    sourceConfidence: 85,
    soldCount: bids,
    transactionSignal: bids != null && bids > 0 ? "bids_present" : null,
    listingCount: 1,
    reviewCount: null,
    rating: asNumber(seller.Rating),
    priceHistory:
      price != null ? [{ price, currency: "JPY", observedAt }] : [],
    popularityRank: null,
    gtin: null,
    sku: null,
    asin: null,
    epid: null,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
  };
}

export function createYahooAuctionAdapter(
  fetchImpl = defaultFetch(),
): MarketplaceAdapter {
  return {
    marketplace: "yahoo_auction",
    status() {
      const enabled = Boolean(env("YAHOO_AUCTION_APP_ID") || env("YAHOO_APPID"));
      return {
        marketplace: "yahoo_auction",
        enabled,
        reason: enabled ? null : "YAHOO_AUCTION_APP_ID missing",
        sourceType: "official_api",
      };
    },
    async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
      const appid = env("YAHOO_AUCTION_APP_ID") || env("YAHOO_APPID");
      if (!appid) {
        return disabledResult(
          "yahoo_auction",
          input.query,
          "Yahoo Auction official API app id missing",
          "official_api",
        );
      }
      const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
      const endpoint =
        env("YAHOO_AUCTION_SEARCH_URL") ||
        "https://auctions.yahooapis.jp/AuctionWebService/V2/search";
      const url = `${endpoint}?appid=${encodeURIComponent(appid)}&query=${encodeURIComponent(input.query)}&output=json&results=${limit}`;
      const response = await fetchImpl(url);
      if (!response.ok) {
        return {
          ...emptyEnabledResult("yahoo_auction", input.query, "official_api"),
          unavailableReason: `yahoo_auction_api_http_${response.status}`,
        };
      }
      const json = (await response.json()) as Record<string, unknown>;
      const resultSet =
        ((json.ResultSet ?? json) as Record<string, unknown>).Result ?? json.Result;
      const bag = (resultSet ?? {}) as Record<string, unknown>;
      const itemsRaw = bag.Item ?? bag.Items ?? bag;
      const items = Array.isArray(itemsRaw)
        ? itemsRaw
        : itemsRaw && typeof itemsRaw === "object"
          ? [itemsRaw]
          : [];
      const observedAt = new Date().toISOString();
      const candidates = items
        .map((item) =>
          item && typeof item === "object"
            ? mapItem(item as Record<string, unknown>, observedAt)
            : null,
        )
        .filter((item): item is MarketplaceProductCandidate => Boolean(item));
      return {
        status: {
          marketplace: "yahoo_auction",
          enabled: true,
          reason: null,
          sourceType: "official_api",
        },
        query: input.query,
        candidates,
        fetchedAt: observedAt,
        unavailableReason: null,
      };
    },
  };
}
