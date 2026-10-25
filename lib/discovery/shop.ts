import { isDummyUrl } from "@/lib/products/discovery-filter";
import { productHref } from "@/lib/format";
import type { DiscoveryProduct, DiscoverySale } from "@/lib/discovery/types";

// Only our own checkout destinations are allowed to receive a purchase CTA.
// Supplier/brand/affiliate links can undercut our retail price and bypass our margin.
const DEFAULT_OWNED_SHOP_HOSTS = ["ieufrg-tb.myshopify.com"];

function normalizedHost(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return trimmed.split("/")[0]?.toLowerCase() || null;
}

function ownedShopHosts() {
  return [
    ...DEFAULT_OWNED_SHOP_HOSTS,
    normalizedHost(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN),
    normalizedHost(process.env.NEXT_PUBLIC_BASE_STORE_DOMAIN),
  ].filter((host): host is string => Boolean(host));
}

export function isOwnedStoreUrl(value: string | null | undefined): value is string {
  if (!value || isDummyUrl(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ownedShopHosts().some((ownedHost) => host === ownedHost);
  } catch {
    return false;
  }
}

export function ownedStoreSales(product: Pick<DiscoveryProduct, "sales">): DiscoverySale[] {
  return product.sales.filter((sale) => sale.availability !== "out_of_stock" && isOwnedStoreUrl(sale.productUrl));
}

export function ownedStorePrice(product: Pick<DiscoveryProduct, "productUrl" | "price" | "currency" | "sales">) {
  const sale = ownedStoreSales(product).find((item) => item.price != null && item.price > 0);
  if (sale) return { price: sale.price as number, currency: sale.currency || product.currency || "JPY" };
  if (isOwnedStoreUrl(product.productUrl) && product.price != null && product.price > 0) {
    return { price: product.price, currency: product.currency || "JPY" };
  }
  return null;
}

export function discoveryShopUrl(product: Pick<
  DiscoveryProduct,
  "productUrl" | "officialUrl" | "sales"
>) {
  const fromSales = ownedStoreSales(product).map((item) => item.productUrl).find(Boolean);
  if (fromSales) return fromSales;
  if (isOwnedStoreUrl(product.productUrl)) return product.productUrl;
  if (isOwnedStoreUrl(product.officialUrl)) return product.officialUrl;
  return null;
}

export function postShopHref(post: {
  productUrl: string | null;
  sourceUrl: string | null;
}) {
  return productHref(post);
}
