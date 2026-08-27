import type { DiscoveryProduct } from "@/lib/discovery/types";

export type ProductSignal = {
  key: string;
  label: string;
};

export function isJapanProduct(product: Pick<DiscoveryProduct, "country" | "category">) {
  const country = (product.country ?? "").trim().toLowerCase();
  return country === "japan" || country === "jp" || product.category === "japan_brand";
}

export function productSignals(product: DiscoveryProduct): ProductSignal[] {
  const chips: ProductSignal[] = [];
  if (product.trendTags.includes("viral")) chips.push({ key: "hot", label: "🔥 HOT" });
  if (product.trendTags.includes("trending")) chips.push({ key: "trending", label: "📈 TRENDING" });
  if (product.trendTags.includes("new_release")) chips.push({ key: "new_product", label: "🛍 NEW PRODUCT" });
  if (product.people.length > 0) chips.push({ key: "celebrity", label: "👤 CELEBRITY" });
  if (product.trendTags.includes("hidden_gem")) chips.push({ key: "hidden_gem", label: "Hidden Gem" });
  if (isJapanProduct(product)) chips.push({ key: "japan", label: "🇯🇵 JAPAN" });
  return chips;
}
