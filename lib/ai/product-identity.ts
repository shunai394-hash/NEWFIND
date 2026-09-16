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

export function productIdentityKey(input: ProductIdentityInput) {
  const gtin = compact(input.gtin);
  if (gtin.length >= 8) return `gtin:${gtin}`;
  const sku = compact(input.sku);
  const brand = normalizeBrand(input.brand);
  if (sku && brand) return `sku:${brand}:${sku}`;
  const model = compact(input.modelNumber);
  if (model && brand) return `model:${brand}:${model}`;
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
      ["new_release", "re_discovered", "rising"].includes(tag),
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
  const brand = normalizeBrand(candidate.brand);
  const name = normalizeProductName(candidate.productName);
  const coreName = coreProductName(candidate.productName);

  const match =
    existing.find((item) => {
      if (item.status === "rejected") return false;
      if (productIdentityKey(item) === candidateKey) return true;
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
