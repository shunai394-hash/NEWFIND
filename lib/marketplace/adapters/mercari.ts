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

/**
 * Mercari has no public official search API.
 * Enabled only when a partner endpoint is explicitly configured.
 * This adapter never scrapes mercari.com / jp.mercari.com.
 */
function mapItem(
  item: Record<string, unknown>,
  observedAt: string,
): MarketplaceProductCandidate | null {
  const id = asString(item.id) || asString(item.item_id);
  const url = asString(item.url) || asString(item.item_url);
  const title = asString(item.name) || asString(item.title);
  if (!id || !url || !title || !isHttpUrl(url)) return null;
  const imageUrl = asString(item.image_url) || asString(item.thumbnail);
  const price = asNumber(item.price);
  return {
    marketplace: "mercari",
    externalProductId: id,
    title,
    brand: asString(item.brand) || asString(item.brand_name),
    category: asString(item.category) || asString(item.category_name),
    url,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null,
    price,
    currency: asString(item.currency) ?? "JPY",
    sellerName: asString(item.seller_name) || asString(item.seller_id),
    sellerType: "marketplace_seller",
    availability: item.status === "sold" || item.sold ? "ended" : "in_stock",
    observedAt,
    sourceType: "official_api",
    sourceConfidence: 80,
    soldCount: item.sold || item.status === "sold" ? 1 : null,
    transactionSignal:
      item.sold || item.status === "sold" ? "sold" : asString(item.status),
    listingCount: 1,
    reviewCount: asNumber(item.review_count),
    rating: asNumber(item.rating),
    priceHistory:
      price != null
        ? [{ price, currency: asString(item.currency) ?? "JPY", observedAt }]
        : [],
    popularityRank: asNumber(item.rank),
    gtin: asString(item.gtin),
    sku: asString(item.sku),
    asin: null,
    epid: null,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
  };
}

export function createMercariAdapter(fetchImpl = defaultFetch()): MarketplaceAdapter {
  return {
    marketplace: "mercari",
    status() {
      const enabled = Boolean(env("MERCARI_API_BASE") && env("MERCARI_API_KEY"));
      return {
        marketplace: "mercari",
        enabled,
        reason: enabled
          ? null
          : "Mercari official/partner API not configured (MERCARI_API_BASE + MERCARI_API_KEY)",
        sourceType: "official_api",
      };
    },
    async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
      const base = env("MERCARI_API_BASE");
      const key = env("MERCARI_API_KEY");
      if (!base || !key) {
        return disabledResult(
          "mercari",
          input.query,
          "Mercari official API unavailable; adapter disabled (no scraping)",
          "official_api",
        );
      }
      const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
      const url = `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(input.query)}&limit=${limit}`;
      const response = await fetchImpl(url, {
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/json",
        },
      });
      if (!response.ok) {
        return {
          ...emptyEnabledResult("mercari", input.query, "official_api"),
          unavailableReason: `mercari_api_http_${response.status}`,
        };
      }
      const json = (await response.json()) as Record<string, unknown>;
      const items = Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.data)
          ? json.data
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
          marketplace: "mercari",
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
