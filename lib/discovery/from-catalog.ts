import { isDummyUrl } from "@/lib/products/discovery-filter";
import type { CatalogProduct } from "@/lib/products/types";
import type {
  DiscoveryCategory,
  DiscoveryProduct,
  PersonRelation,
  SourceTier,
  SourceType,
  TrendTag,
} from "@/lib/discovery/types";
import { normalizeBrand, normalizeProductName } from "@/lib/discovery/normalize";

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function mapRelation(value: string | null): PersonRelation {
  if (value === "\u611b\u7528") return "used";
  if (value === "\u7740\u7528") return "worn";
  if (value === "\u7d39\u4ecb") return "featured";
  if (value === "\u30d7\u30ed\u30c7\u30e5\u30fc\u30b9") return "featured";
  if (value === "\u30a2\u30f3\u30d0\u30b5\u30c0\u30fc") return "featured";
  return "unknown";
}

function mapSource(kind: CatalogProduct["sourceKind"]): { type: SourceType; tier: SourceTier } {
  if (kind === "brand_official") return { type: "brand_official", tier: 1 };
  if (kind === "official_sns") return { type: "official_person", tier: 1 };
  if (kind === "magazine") return { type: "magazine", tier: 2 };
  if (kind === "news") return { type: "news", tier: 2 };
  if (kind === "press") return { type: "brand_official", tier: 2 };
  if (kind === "survey") return { type: "editorial", tier: 3 };
  return { type: "other", tier: 4 };
}

function mapCategory(product: CatalogProduct): DiscoveryCategory {
  if (product.collections.includes("fragrance")) return "fragrance";
  if (product.collections.includes("beauty")) return "beauty";
  if (product.collections.includes("accessories") && !product.collections.includes("fashion")) {
    return "accessories";
  }
  if (product.collections.includes("fashion")) return "fashion";
  if (product.collections.includes("japan_brands")) return "japan_brand";
  if (product.collections.includes("celebrity")) return "celebrity_style";
  return "other";
}

function mapTags(product: CatalogProduct): TrendTag[] {
  const tags = new Set<TrendTag>();
  if (product.collections.includes("trending")) tags.add("trending");
  if (product.collections.includes("celebrity")) tags.add("celebrity_pick");
  if (product.collections.includes("teen")) {
    tags.add("gen_z_trend");
    tags.add("teen");
    tags.add("high_school");
  }
  if (product.collections.includes("japan_brands")) tags.add("japan_trend");
  if (product.collections.includes("fragrance")) tags.add("editorial_pick");
  return [...tags];
}

function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function catalogProductToDiscovery(product: CatalogProduct): DiscoveryProduct | null {
  if (isDummyUrl(product.sourceUrl) || isDummyUrl(product.purchaseUrl)) return null;
  const now = product.publishedAt ? new Date(product.publishedAt).toISOString() : new Date().toISOString();
  const sourceMeta = mapSource(product.sourceKind);
  const sourceId = `${product.id}-src-1`;
  const people = product.celebrityName
    ? [
        {
          id: `${product.id}-person-1`,
          personName: product.celebrityName,
          personType: "celebrity" as const,
          personUrl: null,
          personImageUrl: null,
          relation: mapRelation(product.celebrityRelation),
          sourceId,
          createdAt: now,
        },
      ]
    : [];

  return {
    id: product.id,
    brand: product.brand,
    productName: product.name,
    category: mapCategory(product),
    subcategory: product.subcategoryLabel || product.subcategory,
    country: product.collections.includes("japan_brands") ? "JP" : null,
    description: product.description,
    productImageUrl: product.imageUrl,
    productUrl: product.purchaseUrl,
    officialUrl: product.purchaseUrl,
    price: parsePrice(product.priceText),
    currency: "JPY",
    sku: null,
    trendScore: product.popularityScore,
    confidenceScore: product.celebrityName ? 78 : 64,
    discoverySource: "editorial",
    discoveredAt: now,
    attentionReason: "",
    status: "pending",
    normalizedBrand: normalizeBrand(product.brand),
    normalizedProductName: normalizeProductName(product.name),
    trendTags: mapTags(product),
    sources: [
      {
        id: sourceId,
        sourceType: sourceMeta.type,
        sourceUrl: product.sourceUrl,
        sourceTitle: product.sourceTitle,
        sourceDomain: domainOf(product.sourceUrl),
        publishedAt: product.publishedAt,
        sourceExcerpt: null,
        verificationStatus: "verified",
        sourceTier: sourceMeta.tier,
        createdAt: now,
      },
    ],
    people,
    sales: [
      {
        id: `${product.id}-sale-1`,
        sellerName: product.seller,
        productUrl: product.purchaseUrl,
        price: parsePrice(product.priceText),
        currency: "JPY",
        availability: "unknown",
        officialStore: true,
        sellerKind: "official",
        affiliateUrl: null,
        lastVerifiedAt: now,
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
