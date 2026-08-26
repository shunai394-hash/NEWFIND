import type { CategoryId, PostView, VisualKind } from "@/lib/types";

export type FeedChannelId =
  | "today"
  | "fashion"
  | "beauty"
  | "accessories"
  | "fragrance"
  | "japan_brands"
  | "celebrity"
  | "anime_culture";

export type FeedChannel = {
  id: FeedChannelId;
  label: string;
  hint: string;
  categories: CategoryId[] | null;
};

export const FEED_CHANNELS: FeedChannel[] = [
  {
    id: "today",
    label: "TODAY IN JAPAN",
    hint: "今、日本で見つかっているもの",
    categories: null,
  },
  {
    id: "fashion",
    label: "FASHION",
    hint: "日本で話題のファッション",
    categories: ["fashion"],
  },
  {
    id: "beauty",
    label: "BEAUTY",
    hint: "日本で人気のコスメ",
    categories: ["beauty"],
  },
  {
    id: "accessories",
    label: "ACCESSORIES",
    hint: "バッグ・靴・小物",
    categories: ["accessories"],
  },
  {
    id: "fragrance",
    label: "FRAGRANCE",
    hint: "日本で使われている香水",
    categories: ["fragrance"],
  },
  {
    id: "japan_brands",
    label: "JAPAN BRANDS",
    hint: "日本ブランドの新商品",
    categories: ["japan_brands"],
  },
  {
    id: "celebrity",
    label: "CELEBRITY STYLE",
    hint: "出典がある着用・愛用情報",
    categories: ["celebrity"],
  },
  {
    id: "anime_culture",
    label: "ANIME & CULTURE",
    hint: "アニメ・ポップカルチャー",
    categories: ["anime_culture"],
  },
];

const CATEGORY_JAPAN_CONTEXT: Record<CategoryId, string> = {
  fashion: "日本で話題のファッション",
  beauty: "日本で人気のコスメ",
  accessories: "日本で人気のバッグ・小物",
  fragrance: "日本で使われている香水",
  japan_brands: "日本ブランド",
  celebrity: "セレブリティスタイル",
  anime_culture: "日本のポップカルチャー",
  food: "日本のカフェ・グルメ",
  home: "日本の暮らし",
  tech: "日本で注目のガジェット",
  sports: "日本のスポーツスタイル",
  lifestyle: "日本の街で見つけたもの",
  travel: "日本の街・店舗",
  other: "日本で今見つかっているもの",
};

const VISUAL_KIND_LABELS: Record<VisualKind, string> = {
  model: "リアルなファッション",
  product: "商品",
  street: "日本の街・店舗",
  lifestyle: "ライフスタイル",
  illustration: "イラスト",
  anime: "アニメ・カルチャー",
  brand: "ブランドビジュアル",
};

export function japanContextFor(post: Pick<PostView, "japanContext" | "category" | "author" | "source">) {
  if (post.japanContext?.trim()) return post.japanContext.trim();
  const username = post.author?.username ?? "";
  if (username.startsWith("nfdemo_") && !username.startsWith("nfdemo_jp_")) {
    return null;
  }
  return CATEGORY_JAPAN_CONTEXT[post.category] ?? "日本で今見つかっているもの";
}

export function celebrityLine(
  post: Pick<PostView, "featuredPerson" | "featuredCredit">,
) {
  const person = post.featuredPerson?.trim();
  const credit = post.featuredCredit?.trim();
  if (!person || !credit) return null;
  return {
    label: `${person}が着用`,
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
  if (post.category === "travel" || /街|店舗|ショップ|カフェ|駅/.test(caption)) {
    return "street";
  }
  if (/商品|購入|新作|パッケージ/.test(caption) || post.category === "fragrance") {
    return "product";
  }
  if (post.category === "japan_brands") return "brand";
  if (post.category === "lifestyle" || post.category === "home") return "lifestyle";
  return "model";
}
