import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
import { isDummyUrl } from "@/lib/products/discovery-filter";
import type { CatalogProduct, ProductCollection } from "@/lib/products/types";

function isUsableProduct(product: CatalogProduct): boolean {
  if (!product.sourceUrl || !product.purchaseUrl) return false;
  if (isDummyUrl(product.sourceUrl) || isDummyUrl(product.purchaseUrl)) return false;
  if (product.celebrityName && !product.sourceUrl) return false;
  return true;
}

export function listCatalogProducts(): CatalogProduct[] {
  return CATALOG_PRODUCTS.filter(isUsableProduct).sort(
    (a, b) => b.popularityScore - a.popularityScore,
  );
}

export function getCatalogProduct(id: string): CatalogProduct | null {
  return listCatalogProducts().find((product) => product.id === id) ?? null;
}

export function listProductsByCollection(
  collection: ProductCollection | "all",
): CatalogProduct[] {
  const products = listCatalogProducts();
  if (collection === "all" || collection === "trending") {
    return products;
  }
  return products.filter((product) => product.collections.includes(collection));
}

export function relatedProducts(product: CatalogProduct, limit = 6): CatalogProduct[] {
  return listCatalogProducts()
    .filter((item) => item.id !== product.id)
    .map((item) => {
      const overlap = item.collections.filter((collection) =>
        product.collections.includes(collection),
      ).length;
      const sameCelebrity =
        product.celebrityName && item.celebrityName === product.celebrityName ? 3 : 0;
      const sameBrand = item.brand === product.brand ? 2 : 0;
      return { item, score: overlap + sameCelebrity + sameBrand };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.popularityScore - a.item.popularityScore)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function searchCatalogProducts(query: string): CatalogProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return listCatalogProducts();
  return listCatalogProducts().filter((product) => {
    const haystack = [
      product.name,
      product.brand,
      product.subcategoryLabel,
      product.description,
      product.celebrityName ?? "",
      ...product.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
