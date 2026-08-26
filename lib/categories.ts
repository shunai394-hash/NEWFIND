import { CATEGORIES, type CategoryId } from "@/lib/types";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  fashion: "ファッション",
  beauty: "ビューティー",
  food: "フード",
  home: "ホーム",
  tech: "テック",
  sports: "スポーツ",
  lifestyle: "ライフスタイル",
  travel: "トラベル",
  other: "その他",
  accessories: "アクセサリー",
  fragrance: "香水・コロン",
  japan_brands: "日本ブランド",
  celebrity: "セレブリティスタイル",
  anime_culture: "アニメ・カルチャー",
};

export function categoryLabel(id: CategoryId | string) {
  return (CATEGORY_LABELS as Record<string, string>)[id] ?? id;
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORIES as readonly string[]).includes(value);
}

export const POST_CATEGORIES: CategoryId[] = [
  "fashion",
  "beauty",
  "accessories",
  "fragrance",
  "japan_brands",
  "celebrity",
  "anime_culture",
  "lifestyle",
  "food",
  "travel",
  "home",
  "tech",
  "sports",
  "other",
];
