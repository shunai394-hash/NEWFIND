import type { DiscoveryProduct } from "@/lib/discovery/types";

function identity(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\\s\\p{P}\\p{S}]+/gu, "");
}

function hasTracerPurchaseDestination(product: DiscoveryProduct) {
  return product.sales.some((sale) =>
    /tracer online store/i.test(sale.sellerName) &&
    /^https:\/\/tracer-pied-alpha\.vercel\.app\/shop\//i.test(sale.affiliateUrl ?? sale.productUrl),
  );
}

function asinIdentity(product: DiscoveryProduct) {
  const text = [product.productName, product.description, product.modelNumber ?? ""].join(" ");
  const match = /\bASIN\s*[：:]?\s*([A-Z0-9]{10})\b/i.exec(text);
  const candidate = match?.[1] ??
    (product.modelNumber && /^[A-Z0-9]{10}$/i.test(product.modelNumber) ? product.modelNumber : null);
  return candidate ? `asin:${candidate.toUpperCase()}` : null;
}

function completeness(product: DiscoveryProduct) {
  return Number(hasTracerPurchaseDestination(product)) * 100
    + Number(Boolean(product.productImageUrl)) * 2
    + Number(product.price !== null && product.price > 0) * 2
    + Number(Boolean(product.sales?.length)) * 3
    + Number(Boolean(product.sources?.length))
    + Number(Boolean(product.description?.trim()));
}

function identifiers(product: DiscoveryProduct) {
  return [product.gtin, product.sku, product.modelNumber, asinIdentity(product)]
    .map(identity)
    .filter(Boolean);
}

function sameVariant(a: DiscoveryProduct, b: DiscoveryProduct) {
  const left = identifiers(a);
  const right = identifiers(b);
  // If both records have identifiers, require at least one matching identifier.
  // Different GTIN/SKU/model values can represent real variants and must be kept.
  if (left.length && right.length) return left.some((value) => right.includes(value));
  // Without identifiers, exact normalized brand + product name is the safest available match.
  return true;
}

/** Hide likely exact duplicates while preserving records with conflicting variant identifiers. */
export function dedupeStorefrontProducts(products: DiscoveryProduct[]) {
  const ranked = [...products].sort((a, b) => completeness(b) - completeness(a));
  const seen = new Map<string, DiscoveryProduct[]>();
  const seenAsins = new Set<string>();
  const result: DiscoveryProduct[] = [];
  for (const product of ranked) {
    const asin = asinIdentity(product);
    // ASIN is a stable product identifier even when editorial and TRACER
    // records use different display titles. Keep the richest live TRACER
    // purchase destination, not a stale marketplace-only seed.
    if (asin && seenAsins.has(asin)) continue;
    const brand = identity(product.brand);
    const name = identity(product.productName);
    if (!brand || !name) {
      result.push(product);
      if (asin) seenAsins.add(asin);
      continue;
    }
    const key = `${brand}::${name}`;
    const candidates = seen.get(key) ?? [];
    if (candidates.some((candidate) => sameVariant(candidate, product))) continue;
    candidates.push(product);
    seen.set(key, candidates);
    result.push(product);
    if (asin) seenAsins.add(asin);
  }
  return result;
}
