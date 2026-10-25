import type { DiscoveryProduct } from "@/lib/discovery/types";

function identity(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function completeness(product: DiscoveryProduct) {
  return Number(Boolean(product.productImageUrl)) * 2
    + Number(product.price !== null && product.price > 0) * 2
    + Number(Boolean(product.sales?.length)) * 3
    + Number(Boolean(product.sources?.length))
    + Number(Boolean(product.description?.trim()));
}

/** Hide exact brand + product-name duplicates in storefront views without merging distinct variants. */
export function dedupeStorefrontProducts(products: DiscoveryProduct[]) {
  const ranked = [...products].sort((a, b) => completeness(b) - completeness(a));
  const seen = new Set<string>();
  const result: DiscoveryProduct[] = [];
  for (const product of ranked) {
    const brand = identity(product.brand);
    const name = identity(product.productName);
    // Missing identity fields are not safe to merge, so keep those records visible.
    if (!brand || !name) {
      result.push(product);
      continue;
    }
    const key = `${brand}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }
  return result;
}
