import { createHmac, createHash } from "node:crypto";
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

type AmazonEnv = {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host: string;
  region: string;
  marketplaceHost: string;
};

function amazonEnv(): AmazonEnv | null {
  const accessKey = env("AMAZON_PAAPI_ACCESS_KEY");
  const secretKey = env("AMAZON_PAAPI_SECRET_KEY");
  const partnerTag = env("AMAZON_PAAPI_PARTNER_TAG");
  if (!accessKey || !secretKey || !partnerTag) return null;
  return {
    accessKey,
    secretKey,
    partnerTag,
    host: env("AMAZON_PAAPI_HOST") || "webservices.amazon.co.jp",
    region: env("AMAZON_PAAPI_REGION") || "us-west-2",
    marketplaceHost: env("AMAZON_PAAPI_MARKETPLACE") || "www.amazon.co.jp",
  };
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function amzDate(now: Date) {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz: iso, date: iso.slice(0, 8) };
}

function signPaapi(input: {
  host: string;
  region: string;
  accessKey: string;
  secretKey: string;
  body: string;
  now?: Date;
}) {
  const { amz, date } = amzDate(input.now ?? new Date());
  const service = "ProductAdvertisingAPI";
  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:application/json; charset=utf-8`,
    `host:${input.host}`,
    `x-amz-date:${amz}`,
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems`,
  ].join("\n");
  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonical = [
    "POST",
    "/paapi5/searchitems",
    "",
    canonicalHeaders,
    "",
    signedHeaders,
    sha256Hex(input.body),
  ].join("\n");
  const credentialScope = `${date}/${input.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonical),
  ].join("\n");
  const kDate = hmac(`AWS4${input.secretKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");
  return {
    amz,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function mapItem(
  item: Record<string, unknown>,
  observedAt: string,
): MarketplaceProductCandidate | null {
  const asin = asString(item.ASIN);
  const detail = asString(item.DetailPageURL);
  if (!asin || !detail || !isHttpUrl(detail)) return null;
  const info = (item.ItemInfo ?? {}) as Record<string, unknown>;
  const titleNode = (info.Title ?? {}) as Record<string, unknown>;
  const byline = (info.ByLineInfo ?? {}) as Record<string, unknown>;
  const brandNode = (byline.Brand ?? {}) as Record<string, unknown>;
  const classNode = (info.Classifications ?? {}) as Record<string, unknown>;
  const binding = (classNode.Binding ?? {}) as Record<string, unknown>;
  const images = (item.Images ?? {}) as Record<string, unknown>;
  const primary = (images.Primary ?? {}) as Record<string, unknown>;
  const large = (primary.Large ?? {}) as Record<string, unknown>;
  const offers = (item.Offers ?? {}) as Record<string, unknown>;
  const listings = Array.isArray(offers.Listings) ? offers.Listings : [];
  const listing = (listings[0] ?? {}) as Record<string, unknown>;
  const priceNode = (listing.Price ?? {}) as Record<string, unknown>;
  const availability = (listing.Availability ?? {}) as Record<string, unknown>;
  const reviews = (item.CustomerReviews ?? {}) as Record<string, unknown>;
  const browse = (item.BrowseNodeInfo ?? {}) as Record<string, unknown>;
  const salesRank = Array.isArray(browse.WebsiteSalesRank)
    ? (browse.WebsiteSalesRank[0] as Record<string, unknown> | undefined)
    : (browse.WebsiteSalesRank as Record<string, unknown> | undefined);
  const price = asNumber(priceNode.Amount);
  const imageUrl = asString(large.URL);
  const title = asString(titleNode.DisplayValue) ?? `Amazon ${asin}`;
  return {
    marketplace: "amazon",
    externalProductId: asin,
    title,
    brand: asString(brandNode.DisplayValue),
    category: asString(binding.DisplayValue),
    url: detail,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null,
    price,
    currency: asString(priceNode.Currency) ?? "JPY",
    sellerName: asString(
      ((listing.MerchantInfo ?? {}) as Record<string, unknown>).Name,
    ),
    sellerType: "official_retailer",
    availability: asString(availability.Message)
      ? /in stock|在庫/i.test(String(availability.Message))
        ? "in_stock"
        : "unknown"
      : "unknown",
    observedAt,
    sourceType: "official_api",
    sourceConfidence: 90,
    soldCount: null,
    transactionSignal: null,
    listingCount: null,
    reviewCount: asNumber(reviews.Count),
    rating: asNumber(
      ((reviews.StarRating ?? {}) as Record<string, unknown>).Value,
    ),
    priceHistory:
      price != null
        ? [{ price, currency: asString(priceNode.Currency) ?? "JPY", observedAt }]
        : [],
    popularityRank: asNumber(salesRank?.SalesRank),
    gtin: (() => {
      const ids = (info.ExternalIds ?? {}) as Record<string, unknown>;
      const eans = (ids.EANs ?? {}) as Record<string, unknown>;
      const values = Array.isArray(eans.DisplayValues) ? eans.DisplayValues : [];
      return asString(values[0]);
    })(),
    sku: null,
    asin,
    epid: null,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
  };
}

export function createAmazonAdapter(fetchImpl = defaultFetch()): MarketplaceAdapter {
  return {
    marketplace: "amazon",
    status() {
      const cfg = amazonEnv();
      if (!cfg) {
        return {
          marketplace: "amazon",
          enabled: false,
          reason: "AMAZON_PAAPI_ACCESS_KEY / SECRET_KEY / PARTNER_TAG missing",
          sourceType: "official_api",
        };
      }
      return {
        marketplace: "amazon",
        enabled: true,
        reason: null,
        sourceType: "official_api",
      };
    },
    async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
      const cfg = amazonEnv();
      if (!cfg) {
        return disabledResult(
          "amazon",
          input.query,
          "AMAZON_PAAPI credentials missing",
          "official_api",
        );
      }
      const body = JSON.stringify({
        PartnerTag: cfg.partnerTag,
        PartnerType: "Associates",
        Keywords: input.query,
        SearchIndex: "All",
        Marketplace: `www.${cfg.marketplaceHost.replace(/^www\./, "")}`,
        ItemCount: Math.max(1, Math.min(input.limit ?? 10, 10)),
        Resources: [
          "Images.Primary.Large",
          "ItemInfo.Title",
          "ItemInfo.ByLineInfo",
          "ItemInfo.Classifications",
          "ItemInfo.ExternalIds",
          "Offers.Listings.Price",
          "Offers.Listings.Availability.Message",
          "Offers.Listings.MerchantInfo",
          "CustomerReviews.Count",
          "CustomerReviews.StarRating",
          "BrowseNodeInfo.WebsiteSalesRank",
        ],
      });
      const signed = signPaapi({
        host: cfg.host,
        region: cfg.region,
        accessKey: cfg.accessKey,
        secretKey: cfg.secretKey,
        body,
      });
      const response = await fetchImpl(`https://${cfg.host}/paapi5/searchitems`, {
        method: "POST",
        headers: {
          "content-encoding": "amz-1.0",
          "content-type": "application/json; charset=utf-8",
          host: cfg.host,
          "x-amz-date": signed.amz,
          "x-amz-target":
            "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
          authorization: signed.authorization,
        },
        body,
      });
      if (!response.ok) {
        return {
          ...emptyEnabledResult("amazon", input.query, "official_api"),
          unavailableReason: `amazon_api_http_${response.status}`,
        };
      }
      const json = (await response.json()) as Record<string, unknown>;
      const result = (json.SearchResult ?? {}) as Record<string, unknown>;
      const items = Array.isArray(result.Items) ? result.Items : [];
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
          marketplace: "amazon",
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
