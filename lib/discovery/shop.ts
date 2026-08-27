import { isDummyUrl } from "@/lib/products/discovery-filter";
import { productHref } from "@/lib/format";
import type { DiscoveryProduct } from "@/lib/discovery/types";

function liveHttps(url: string | null | undefined) {
  if (!url || isDummyUrl(url)) return null;
  return url.startsWith("https://") ? url : null;
}

export function discoveryShopUrl(product: Pick<
  DiscoveryProduct,
  "productUrl" | "officialUrl" | "sales"
>) {
  const fromSales = product.sales
    .map((item) => liveHttps(item.affiliateUrl) || liveHttps(item.productUrl))
    .find(Boolean);
  return fromSales || liveHttps(product.productUrl) || liveHttps(product.officialUrl) || null;
}

export function postShopHref(post: {
  productUrl: string | null;
  sourceUrl: string | null;
}) {
  return productHref(post);
}
