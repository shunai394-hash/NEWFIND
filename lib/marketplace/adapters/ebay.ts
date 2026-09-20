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

async function ebayToken(fetchImpl: ReturnType<typeof defaultFetch>) {
  const ready = env("EBAY_OAUTH_TOKEN");
  if (ready) return ready;
  const id = env("EBAY_APP_ID") || env("EBAY_CLIENT_ID");
  const secret = env("EBAY_CERT_ID") || env("EBAY_CLIENT_SECRET");
  if (!id || !secret) return null;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetchImpl("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { access_token?: string };
  return json.access_token ?? null;
}

function mapItem(
  item: Record<string, unknown>,
  observedAt: string,
): MarketplaceProductCandidate | null {
  const id = asString(item.itemId) || asString(item.legacyItemId);
  const url = asString(item.itemWebUrl);
  const title = asString(item.title);
  if (!id || !url || !title || !isHttpUrl(url)) return null;
  const priceNode = (item.price ?? {}) as Record<string, unknown>;
  const image = (item.image ?? {}) as Record<string, unknown>;
  const seller = (item.seller ?? {}) as Record<string, unknown>;
  const epid = asString(
    ((item.epid ?? item.legacyItemId) as string | undefined) ?? null,
  );
  const price = asNumber(priceNode.value);
  const imageUrl = asString(image.imageUrl);
  return {
    marketplace: "ebay",
    externalProductId: id,
    title,
    brand: asString(
      ((item.itemSpecifics as Record<string, unknown>[] | undefined)?.find(
        (row) => String(row.name ?? "").toLowerCase() === "brand",
      )?.value as string | undefined) ?? null,
    ),
    category: asString(
      ((Array.isArray(item.categories) ? item.categories[0] : null) as
        | Record<string, unknown>
        | null)?.categoryName,
    ),
    url,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null,
    price,
    currency: asString(priceNode.currency) ?? "USD",
    sellerName: asString(seller.username),
    sellerType: "marketplace_seller",
    availability: Array.isArray(item.buyingOptions)
      ? "in_stock"
      : "unknown",
    observedAt,
    sourceType: "official_api",
    sourceConfidence: 88,
    soldCount: asNumber(
      ((item.estimatedAvailabilities as Record<string, unknown>[] | undefined)?.[0]
        ?.estimatedSoldQuantity as number | undefined) ?? null,
    ),
    transactionSignal: asString(item.condition),
    listingCount: asNumber(item.itemOriginDate ? 1 : null),
    reviewCount: null,
    rating: asNumber(seller.feedbackPercentage),
    priceHistory:
      price != null
        ? [
            {
              price,
              currency: asString(priceNode.currency) ?? "USD",
              observedAt,
            },
          ]
        : [],
    popularityRank: null,
    gtin: asString(item.gtin),
    sku: asString(item.mpn),
    asin: null,
    epid,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
  };
}

export function createEbayAdapter(fetchImpl = defaultFetch()): MarketplaceAdapter {
  return {
    marketplace: "ebay",
    status() {
      const enabled = Boolean(
        env("EBAY_OAUTH_TOKEN") ||
          ((env("EBAY_APP_ID") || env("EBAY_CLIENT_ID")) &&
            (env("EBAY_CERT_ID") || env("EBAY_CLIENT_SECRET"))),
      );
      return {
        marketplace: "ebay",
        enabled,
        reason: enabled ? null : "EBAY_OAUTH_TOKEN or EBAY_APP_ID/EBAY_CERT_ID missing",
        sourceType: "official_api",
      };
    },
    async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
      const token = await ebayToken(fetchImpl);
      if (!token) {
        return disabledResult(
          "ebay",
          input.query,
          "eBay official API credentials missing",
          "official_api",
        );
      }
      const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(input.query)}&limit=${limit}`;
      const response = await fetchImpl(url, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-ebay-c-marketplace-id": env("EBAY_MARKETPLACE_ID") || "EBAY_US",
        },
      });
      if (!response.ok) {
        return {
          ...emptyEnabledResult("ebay", input.query, "official_api"),
          unavailableReason: `ebay_api_http_${response.status}`,
        };
      }
      const json = (await response.json()) as Record<string, unknown>;
      const items = Array.isArray(json.itemSummaries) ? json.itemSummaries : [];
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
          marketplace: "ebay",
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
