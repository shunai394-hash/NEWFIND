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
  {
    id: "today",
    label: "TRENDING PRODUCTS",
    hint: "今、日本で見つかっている人気商品",
    categories: null,
  },
  {
    id: "fashion",
    label: "FASHION",
    hint: "洋服・トップス・スカート",
    categories: ["fashion"],
  },
  {
    id: "beauty",
    label: "BEAUTY",
    hint: "コスメ・スキンケア",
    categories: ["beauty"],
  },
  {
    id: "accessories",
    label: "ACCESSORIES",
    hint: "バッグ・靴・アクセサリー",
    categories: ["accessories"],
  },
  {
    id: "fragrance",
    label: "FRAGRANCE",
    hint: "香水・コロン・オードパルファム",
    categories: ["fragrance"],
  },
  {
    id: "japan_brands",
    label: "JAPAN BRANDS",
    hint: "日本ブランドの公式商品",
    categories: ["japan_brands"],
  },
  {
    id: "celebrity",
    label: "CELEBRITY STYLE",
    hint: "出典付きの芸能人愛用品",
    categories: ["celebrity"],
  },
  {
    id: "teen",
    label: "TEEN / HIGH SCHOOL",
    hint: "高校生調査で支持された店舗の定番",
    categories: ["fashion", "beauty", "accessories"],
  },
];

const CATEGORY_JAPAN_CONTEXT: Record<CategoryId, string> = {
  fashion: "今、日本で見つかっている服",
  beauty: "今、日本で見つかっているコスメ",
  accessories: "今、日本で見つかっているアクセサリー",
  fragrance: "今、日本で見つかっている香り",
  japan_brands: "今、日本のブランド",
  celebrity: "出典付きの芸能人スタイル",
  anime_culture: "今、日本のカルチャー",
  food: "今、日本で見つかっている食べ物",
  home: "今、日本の暮らし",
  tech: "今、日本で見つかっているガジェット",
  sports: "今、日本のスポーツスタイル",
  lifestyle: "今、日本で起きていること",
  travel: "今、日本で見つかっている場所",
  other: "今、日本で見つかっているもの",
};

const VISUAL_KIND_LABELS: Record<VisualKind, string> = {
  model: "人物コーデ",
  product: "商品",
  street: "今、日本の街",
  lifestyle: "暮らしの一枚",
  illustration: "イラスト",
  anime: "アニメ・カルチャー",
  brand: "ブランドビジュアル",
};

export function japanContextFor(
  post: Pick<PostView, "japanContext" | "category" | "author" | "source">,
) {
  if (post.japanContext?.trim()) return post.japanContext.trim();
  const username = post.author?.username ?? "";
  if (username.startsWith("nfdemo_") && !username.startsWith("nfdemo_jp_")) {
    return null;
  }
  return CATEGORY_JAPAN_CONTEXT[post.category] ?? "今、日本で見つかっているもの";
}

export function celebrityLine(
  post: Pick<PostView, "featuredPerson" | "featuredCredit">,
) {
  const person = post.featuredPerson?.trim();
  const credit = post.featuredCredit?.trim();
  if (!person && !credit) return null;
  return {
    label: person ? `${person} 関連` : "出典",
    credit,
  };
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
    return /イラスト|アニメ/.test(caption) ? "anime" : "illustration";
  }
  if (post.category === "travel" || /街|スナップ/.test(caption)) {
    return "street";
  }
  if (/商品|ボトル|パッケージ/.test(caption) || post.category === "fragrance") {
    return "product";
  }
  if (post.category === "japan_brands") return "brand";
  if (post.category === "lifestyle" || post.category === "home") return "lifestyle";
  return "model";
}
