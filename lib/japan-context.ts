import type { CategoryId, PostView, VisualKind } from "@/lib/types";

export type FeedChannelId =
  | "today"
  | "fashion"
  | "beauty"
  | "accessories"
  | "fragrance"
  | "japan_brands"
  | "celebrity"
  | "teen";

export type FeedChannel = {
  id: FeedChannelId;
  label: string;
  hint: string;
  categories: CategoryId[] | null;
};

export const FEED_CHANNELS: FeedChannel[] = [
  { id: "today", label: "TRENDING", hint: "Trending products and posts", categories: null },
  { id: "fashion", label: "FASHION", hint: "Clothes, tops, sneakers", categories: ["fashion"] },
  { id: "beauty", label: "BEAUTY", hint: "Makeup, skincare, hair", categories: ["beauty"] },
  { id: "accessories", label: "ACCESSORIES", hint: "Bags, shoes, jewelry", categories: ["accessories"] },
  { id: "fragrance", label: "FRAGRANCE", hint: "Perfume, cologne, EDP", categories: ["fragrance"] },
  { id: "japan_brands", label: "JAPAN BRAND", hint: "Japan brand products", categories: ["japan_brands"] },
  { id: "celebrity", label: "CELEBRITY", hint: "Sourced celebrity style", categories: ["celebrity"] },
  { id: "teen", label: "GEN Z", hint: "Teen / Gen Z products", categories: ["fashion", "beauty", "accessories"] },
];

const VISUAL_KIND_LABELS: Record<VisualKind, string> = {
  model: "Look",
  product: "Product",
  street: "Street",
  lifestyle: "Lifestyle",
  illustration: "Illustration",
  anime: "Anime / culture",
  brand: "Brand",
};

export function japanContextFor(
  post: Pick<PostView, "japanContext" | "category" | "author" | "source">,
) {
  return post.japanContext?.trim() || null;
}

export function celebrityLine(
  post: Pick<PostView, "featuredPerson" | "featuredCredit">,
) {
  const person = post.featuredPerson?.trim();
  const credit = post.featuredCredit?.trim();
  if (!person && !credit) return null;
  return { label: person || "Featured", credit };
}

export function visualKindLabel(kind: VisualKind | null | undefined) {
  if (!kind) return null;
  return VISUAL_KIND_LABELS[kind] ?? null;
}

export function inferVisualKind(
  post: Pick<PostView, "visualKind" | "category" | "caption">,
): VisualKind | null {
  if (post.visualKind) return post.visualKind;
  const caption = post.caption ?? "";
  if (post.category === "anime_culture") {
    return /anime|illustration/i.test(caption) ? "anime" : "illustration";
  }
  if (post.category === "travel") return "street";
  if (post.category === "fragrance") return "product";
  if (post.category === "japan_brands") return "brand";
  if (post.category === "lifestyle" || post.category === "home") return "lifestyle";
  return "product";
}
