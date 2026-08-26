import { isDummyUrl } from "@/lib/products/discovery-filter";
import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
import { catalogProductToDiscovery } from "@/lib/discovery/from-catalog";
import { WORLD_SEED_PRODUCTS } from "@/lib/discovery/world-seed";
import { normalizeBrand, normalizeProductName, sourceDomain } from "@/lib/discovery/normalize";
import type {
  DiscoveryProduct,
  DiscoveryProductInput,
  DiscoveryStatus,
} from "@/lib/discovery/types";

const STORAGE_KEY = "nf_discovery_products_v1";

function seedProducts(): DiscoveryProduct[] {
  const fromCatalog = CATALOG_PRODUCTS.map(catalogProductToDiscovery).filter(
    (item): item is DiscoveryProduct => Boolean(item),
  );
  const byId = new Map<string, DiscoveryProduct>();
  for (const item of [...fromCatalog, ...WORLD_SEED_PRODUCTS]) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let memory = seedProducts();

function readLocalOverlay(): DiscoveryProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiscoveryProduct[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalOverlay(products: DiscoveryProduct[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function mergeById(base: DiscoveryProduct[], overlay: DiscoveryProduct[]) {
  const map = new Map(base.map((item) => [item.id, item]));
  for (const item of overlay) map.set(item.id, item);
  return [...map.values()].sort((a, b) => b.trendScore - a.trendScore);
}

export function listSeedDiscoveryProducts() {
  return clone(seedProducts());
}

export function currentDiscoveryCatalog() {
  return mergeById(memory, readLocalOverlay());
}

export function listDiscoveryProducts(options?: {
  status?: DiscoveryStatus | "all";
  admin?: boolean;
}) {
  const admin = Boolean(options?.admin);
  const status = options?.status ?? (admin ? "all" : "approved");
  return currentDiscoveryCatalog().filter((item) => {
    if (!admin && item.status !== "approved") return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });
}

export function getDiscoveryProduct(id: string, admin = false) {
  const product = currentDiscoveryCatalog().find((item) => item.id === id) ?? null;
  if (!product) return null;
  if (!admin && product.status !== "approved") return null;
  return clone(product);
}

export function canApprove(product: Pick<
  DiscoveryProduct,
  "productName" | "brand" | "productImageUrl" | "sources" | "sales" | "productUrl" | "officialUrl"
>) {
  if (!product.productName.trim() || !product.brand.trim()) return false;
  if (!product.productImageUrl) return false;
  if (product.sources.length === 0) return false;
  if (product.sales.length === 0 && !product.productUrl) return false;
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

export function saveDiscoveryProduct(input: DiscoveryProductInput) {
  const now = new Date().toISOString();
  const next: DiscoveryProduct = {
    ...input,
    sources: input.sources.map((item) => ({
      ...item,
      sourceDomain: item.sourceDomain || sourceDomain(item.sourceUrl),
    })),
    normalizedBrand: normalizeBrand(input.brand),
    normalizedProductName: normalizeProductName(input.productName),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  if (next.status === "approved" && !canApprove(next)) {
    throw new Error("Approved products need an image, a source, and a live product URL.");
  }
  const existing = currentDiscoveryCatalog();
  const duplicate = findDuplicate(next, existing);
  if (duplicate) {
    throw new Error(`Duplicate of ${duplicate.brand} ${duplicate.productName}`);
  }
  const overlay = readLocalOverlay().filter((item) => item.id !== next.id);
  overlay.push(next);
  writeLocalOverlay(overlay);
  memory = mergeById(seedProducts(), overlay);
  return clone(next);
}

export function setDiscoveryStatus(id: string, status: DiscoveryStatus) {
  const current = getDiscoveryProduct(id, true);
  if (!current) throw new Error("Product not found");
  return saveDiscoveryProduct({ ...current, status });
}

export function newDiscoveryId() {
  return `dp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    discoverySource: null,
    status: "draft",
    trendTags: [],
    sources: [],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}
