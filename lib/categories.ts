import { CATEGORIES, type CategoryId } from "@/lib/types";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  fashion: "ファッション",
  beauty: "ビューティー",
  food: "フード",
  home: "ホーム",
  tech: "テック",
  sports: "スポーツ",
  lifestyle: "ライフスタイル",
  other: "その他",
};

export function categoryLabel(id: CategoryId) {
  return CATEGORY_LABELS[id] ?? id;
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORIES as readonly string[]).includes(value);
}
