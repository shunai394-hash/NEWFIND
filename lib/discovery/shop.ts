import { isDummyUrl } from "@/lib/products/discovery-filter";
import type { DiscoveryProduct } from "@/lib/discovery/types";

function liveHttps(url: string | null | undefined) {
  if (!url || isDummyUrl(url)) return null;
  return url.startsWith("https://") ? url : null;
}

/**
 * Only return an attributable affiliate destination for storefront purchase CTAs.
 * Direct retailer URLs are reference information, not a revenue channel for NEWFIND.
 */
export function discoveryShopUrl(product: Pick<DiscoveryProduct, "sales">) {
  return product.sales
    .map((item) => liveHttps(item.affiliateUrl))
    .find(Boolean) || null;
}

export function postShopHref(post: {
  productUrl: string | null;
  sourceUrl: string | null;
}) {
  return null;
}
