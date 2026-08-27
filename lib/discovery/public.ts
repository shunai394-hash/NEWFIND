import { listDiscoveryProducts } from "@/lib/discovery/store";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryCategory } from "@/lib/discovery/types";

export async function listPublicDiscoveryProducts() {
  const products = await listDiscoveryProducts({ admin: false, status: "approved" });
  return products.filter((item) => isUsableProductImage(item.productImageUrl));
}

export async function listPublicByCategory(category: DiscoveryCategory | "all" | "trending") {
  const products = await listPublicDiscoveryProducts();
  if (category === "all") return products;
  if (category === "trending") {
    return products.filter(
      (item) => item.trendTags.includes("trending") || item.trendTags.includes("world_trend"),
    );
  }
  return products.filter((item) => item.category === category);
}
