import { canonicalProductUrl } from "@/lib/discovery/rules";
import { normalizeBrand, normalizeProductName } from "@/lib/discovery/normalize";
import type { DiscoveryProduct } from "@/lib/discovery/types";

const COLOR_WORDS =
  /\b(black|white|navy|red|blue|green|pink|beige|ivory|grey|gray|brown|olive|cream|silver|gold|kuro|shiro|aka|ao)\b/gi;
const SIZE_WORDS = /\b(xs|s|m|l|xl|xxl|small|medium|large|\d+\s?(ml|g|kg|oz|mm|cm))\b/gi;

export type ProductIdentityInput = {
  brand: string;
  productName: string;
  sku?: string | null;
  gtin?: string | null;
  modelNumber?: string | null;
  productUrl?: string | null;
  officialUrl?: string | null;
};

export type ProductMatchKind = "duplicate" | "rediscovery" | "new";

function compact(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, "");
}

export function coreProductName(value: string) {
  return normalizeProductName(value)
    .replace(COLOR_WORDS, " ")
    .replace(SIZE_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractUrlIdentity(url: string | null | undefined): {
  asin: string | null;
  handle: string | null;
  pathKey: string;
} {
  if (!url) return { asin: null, handle: null, pathKey: "" };
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/$/, "").toLowerCase();
    const asinMatch = path.match(/\/(?:dp|gp\/product)\/([a-z0-9]{8,})/i);
    const handleMatch = path.match(
      /\/(?:products?|goods|items?|sku|pd|detail|prod)\/([^/?#]+)/i,
    );
    return {
      asin: asinMatch?.[1]?.toUpperCase() ?? null,
      handle: handleMatch?.[1] ?? null,
      pathKey: `${host}${path}`,
    };
  } catch {
    return { asin: null, handle: null, pathKey: "" };
  }
}

export function productIdentityKey(input: ProductIdentityInput) {
  const gtin = compact(input.gtin);
  if (gtin.length >= 8) return `gtin:${gtin}`;
  const sku = compact(input.sku);
  const brand = normalizeBrand(input.brand);
  if (sku && brand) return `sku:${brand}:${sku}`;
  const model = compact(input.modelNumber);
  if (model && brand) return `model:${brand}:${model}`;
  const urlId = extractUrlIdentity(input.officialUrl || input.productUrl);
  if (urlId.asin) return `asin:${urlId.asin}`;
  if (urlId.handle) {
    const host = urlId.pathKey.split("/")[0];
    return `handle:${host}:${urlId.handle}`;
  }
  const name = coreProductName(input.productName);
  if (brand && name) return `name:${brand}:${name}`;
  return `url:${canonicalProductUrl(input.officialUrl || input.productUrl)}`;
}

const REDISCOVERY_HINT =
  /new colour|new color|new model|new drop|restock|reissue|re-release|re release|新色|新作|再販|復刻|値下げ|price cut|launch/i;

export function isRediscoveryCandidate(input: {
  productName: string;
  attentionReason?: string | null;
  trendTags?: string[];
  price?: number | null;
  previousPrice?: number | null;
  previousDiscoveredAt?: string | null;
}) {
  const haystack = `${input.productName} ${input.attentionReason ?? ""} ${(input.trendTags ?? []).join(" ")}`;
  if (REDISCOVERY_HINT.test(haystack)) return true;
  if (
    (input.trendTags ?? []).some((tag) =>
      ["new_release", "re_discovered"].includes(tag),
    )
  ) {
    return true;
  }
  if (
    input.price != null &&
    input.previousPrice != null &&
    input.previousPrice > 0 &&
    Math.abs(input.price - input.previousPrice) / input.previousPrice >= 0.2
  ) {
    return true;
  }
  if (input.previousDiscoveredAt) {
    const then = Date.parse(input.previousDiscoveredAt);
    if (Number.isFinite(then) && Date.now() - then > 1000 * 60 * 60 * 24 * 21) {
      return true;
    }
  }
  return false;
}

export function classifyProductMatch(
  candidate: ProductIdentityInput & {
    attentionReason?: string | null;
    trendTags?: string[];
    price?: number | null;
  },
  existing: DiscoveryProduct[],
): { kind: ProductMatchKind; match: DiscoveryProduct | null } {
  const candidateKey = productIdentityKey(candidate);
  const candidateUrl = canonicalProductUrl(candidate.productUrl);
  const candidateOfficial = canonicalProductUrl(candidate.officialUrl);
  const candidateUrlId = extractUrlIdentity(
    candidate.officialUrl || candidate.productUrl,
  );
  const brand = normalizeBrand(candidate.brand);
  const name = normalizeProductName(candidate.productName);
  const coreName = coreProductName(candidate.productName);

  const match =
    existing.find((item) => {
      if (item.status === "rejected") return false;
      if (productIdentityKey(item) === candidateKey) return true;
      const itemUrlId = extractUrlIdentity(item.officialUrl || item.productUrl);
      if (candidateUrlId.asin && itemUrlId.asin === candidateUrlId.asin) {
        return true;
      }
      if (
        candidateUrlId.handle &&
        itemUrlId.handle === candidateUrlId.handle &&
        candidateUrlId.pathKey.split("/")[0] === itemUrlId.pathKey.split("/")[0]
      ) {
        return true;
      }
      if (candidateUrl && canonicalProductUrl(item.productUrl) === candidateUrl) {
        return true;
      }
      if (
        candidateOfficial &&
        canonicalProductUrl(item.officialUrl) === candidateOfficial
      ) {
        return true;
      }
      if (candidate.sku && item.sku && compact(candidate.sku) === compact(item.sku)) {
        return true;
      }
      if (
        item.normalizedBrand === brand &&
        (item.normalizedProductName === name ||
          coreProductName(item.productName) === coreName)
      ) {
        return true;
      }
      return false;
    }) ?? null;

  if (!match) return { kind: "new", match: null };

  if (
    isRediscoveryCandidate({
      productName: candidate.productName,
      attentionReason: candidate.attentionReason,
      trendTags: candidate.trendTags,
      price: candidate.price,
      previousPrice: match.price,
      previousDiscoveredAt: match.discoveredAt,
    })
  ) {
    return { kind: "rediscovery", match };
  }

  return { kind: "duplicate", match };
}
