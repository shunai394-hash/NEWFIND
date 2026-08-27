import { isUsableProductImage } from "@/lib/discovery/media";
import { isDummyUrl } from "@/lib/products/discovery-filter";
import { normalizeBrand, normalizeProductName, sourceDomain } from "@/lib/discovery/normalize";
import type {
  DiscoveryProduct,
  DiscoveryProductInput,
} from "@/lib/discovery/types";

export function newDiscoveryId() {
  return `dp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function newChildId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = (Math.random() * 16) | 0;
    const v = c === "x" ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function asUuid(id: string | null | undefined) {
  if (isUuid(id)) return id;
  return newChildId();
}

export function canApprove(product: Pick<
  DiscoveryProduct,
  "productName" | "brand" | "productImageUrl" | "sources" | "sales" | "productUrl" | "officialUrl"
>) {
  if (!product.productName.trim() || !product.brand.trim()) return false;
  if (!isUsableProductImage(product.productImageUrl)) return false;
  if (product.sources.length === 0) return false;
  if (product.sales.length === 0) return false;
  const urls = [
    product.productUrl,
    product.officialUrl,
    ...product.sources.map((item) => item.sourceUrl),
    ...product.sales.map((item) => item.productUrl),
  ];
  if (urls.some((url) => isDummyUrl(url))) return false;
  if (urls.filter(Boolean).some((url) => !String(url).startsWith("https://"))) return false;
  return true;
}

export function findDuplicate(product: DiscoveryProduct, others: DiscoveryProduct[]) {
  const brand = product.normalizedBrand || normalizeBrand(product.brand);
  const name = product.normalizedProductName || normalizeProductName(product.productName);
  return others.find((item) => {
    if (item.id === product.id || item.status === "rejected") return false;
    if (product.productUrl && item.productUrl === product.productUrl) return item;
    if (product.officialUrl && item.officialUrl === product.officialUrl) return item;
    if (product.sku && item.sku && product.sku === item.sku) return item;
    return item.normalizedBrand === brand && item.normalizedProductName === name;
  }) ?? null;
}

export function prepareDiscoveryProduct(input: DiscoveryProductInput): DiscoveryProduct {
  const now = new Date().toISOString();
  return {
    ...input,
    discoveredAt: input.discoveredAt ?? null,
    attentionReason: input.attentionReason ?? "",
    sources: input.sources.map((item) => ({
      ...item,
      sourceDomain: item.sourceDomain || sourceDomain(item.sourceUrl),
    })),
    normalizedBrand: normalizeBrand(input.brand),
    normalizedProductName: normalizeProductName(input.productName),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function emptyDiscoveryProduct(): DiscoveryProductInput {
  const now = new Date().toISOString();
  return {
    id: newDiscoveryId(),
    brand: "",
    productName: "",
    category: "other",
    subcategory: "",
    country: null,
    description: "",
    productImageUrl: null,
    productUrl: null,
    officialUrl: null,
    price: null,
    currency: "USD",
    sku: null,
    trendScore: 0,
    confidenceScore: 0,
    discoverySource: "admin",
    discoveredAt: now,
    attentionReason: "",
    status: "pending",
    trendTags: [],
    sources: [],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}
