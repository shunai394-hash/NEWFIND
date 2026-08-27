import { isSupabaseConfigured } from "@/lib/config";
import { isUsableProductImage } from "@/lib/discovery/media";
import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
import { catalogProductToDiscovery } from "@/lib/discovery/from-catalog";
import { WORLD_SEED_PRODUCTS } from "@/lib/discovery/world-seed";
import {
  canApprove,
  emptyDiscoveryProduct,
  findDuplicate,
  newDiscoveryId,
  prepareDiscoveryProduct,
} from "@/lib/discovery/rules";
import type {
  DiscoveryProduct,
  DiscoveryProductInput,
  DiscoveryStatus,
} from "@/lib/discovery/types";

export { canApprove, emptyDiscoveryProduct, findDuplicate, newDiscoveryId };

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

function withDiscoveryFields(product: DiscoveryProduct): DiscoveryProduct {
  return {
    ...product,
    discoveredAt: product.discoveredAt ?? null,
    attentionReason: product.attentionReason ?? "",
  };
}

export function listSeedDiscoveryProducts() {
  return clone(seedProducts()).map(withDiscoveryFields);
}

function currentDiscoveryCatalog() {
  return mergeById(memory, readLocalOverlay()).map(withDiscoveryFields);
}

function filterCatalog(
  catalog: DiscoveryProduct[],
  options?: { status?: DiscoveryStatus | "all"; admin?: boolean },
) {
  const admin = Boolean(options?.admin);
  const status = options?.status ?? (admin ? "all" : "approved");
  return catalog.filter((item) => {
    if (!admin && item.status !== "approved") return false;
    if (!admin && !isUsableProductImage(item.productImageUrl)) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });
}

export function listDiscoveryProductsLocal(options?: {
  status?: DiscoveryStatus | "all";
  admin?: boolean;
}) {
  return filterCatalog(currentDiscoveryCatalog(), options);
}

export function getDiscoveryProductLocal(id: string, admin = false) {
  const product = currentDiscoveryCatalog().find((item) => item.id === id) ?? null;
  if (!product) return null;
  if (!admin && product.status !== "approved") return null;
  if (!admin && !isUsableProductImage(product.productImageUrl)) return null;
  return clone(product);
}

export function saveDiscoveryProductLocal(input: DiscoveryProductInput) {
  const next = prepareDiscoveryProduct(input);
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

function isMissingDiscoveryTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /discovery_products|schema cache|42P01/i.test(message);
}

export async function listDiscoveryProducts(options?: {
  status?: DiscoveryStatus | "all";
  admin?: boolean;
}) {
  if (isSupabaseConfigured() && typeof window === "undefined") {
    try {
      const { listDiscoveryProductsFromDb } = await import("@/lib/discovery/db");
      return await listDiscoveryProductsFromDb(options);
    } catch (error) {
      if (!isMissingDiscoveryTable(error)) throw error;
      console.error("[discovery] table missing, using local catalog");
    }
  }
  return listDiscoveryProductsLocal(options);
}

export async function getDiscoveryProduct(id: string, admin = false) {
  if (isSupabaseConfigured() && typeof window === "undefined") {
    try {
      const { getDiscoveryProductFromDb } = await import("@/lib/discovery/db");
      return await getDiscoveryProductFromDb(id, admin);
    } catch (error) {
      if (!isMissingDiscoveryTable(error)) throw error;
      console.error("[discovery] table missing, using local catalog");
    }
  }
  return getDiscoveryProductLocal(id, admin);
}

export async function saveDiscoveryProduct(input: DiscoveryProductInput) {
  const next = prepareDiscoveryProduct(input);
  if (next.status === "approved" && !canApprove(next)) {
    throw new Error("Approved products need an image, a source, and a live product URL.");
  }
  if (isSupabaseConfigured() && typeof window === "undefined") {
    try {
      const { saveDiscoveryProductToDb, listDiscoveryProductsFromDb } = await import("@/lib/discovery/db");
      const existing = await listDiscoveryProductsFromDb({ admin: true, status: "all" });
      const duplicate = findDuplicate(next, existing);
      if (duplicate) {
        throw new Error(`Duplicate of ${duplicate.brand} ${duplicate.productName}`);
      }
      return await saveDiscoveryProductToDb(next);
    } catch (error) {
      if (!isMissingDiscoveryTable(error)) throw error;
      console.error("[discovery] table missing, using local catalog");
    }
  }
  return saveDiscoveryProductLocal(next);
}

export async function setDiscoveryStatus(id: string, status: DiscoveryStatus) {
  const current = await getDiscoveryProduct(id, true);
  if (!current) throw new Error("Product not found");
  return saveDiscoveryProduct({ ...current, status });
}
