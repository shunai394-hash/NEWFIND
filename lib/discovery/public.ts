import { listDiscoveryProducts } from "@/lib/discovery/store";
import type { DiscoveryCategory } from "@/lib/discovery/types";

export function listPublicDiscoveryProducts() {
  return listDiscoveryProducts({ admin: false, status: "approved" });
}

export function listPublicByCategory(category: DiscoveryCategory | "all" | "trending") {
  const products = listPublicDiscoveryProducts();
  if (category === "all") return products;
  if (category === "trending") {
    return products.filter(
      (item) => item.trendTags.includes("trending") || item.trendTags.includes("world_trend"),
    );
  }
  return products.filter((item) => item.category === category);
}
