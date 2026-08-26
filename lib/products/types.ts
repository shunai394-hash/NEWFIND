export const PRODUCT_COLLECTIONS = [
  "trending",
  "fashion",
  "beauty",
  "accessories",
  "fragrance",
  "celebrity",
  "teen",
  "japan_brands",
] as const;

export type ProductCollection = (typeof PRODUCT_COLLECTIONS)[number];

export const PRODUCT_COLLECTION_LABELS: Record<ProductCollection, string> = {
  trending: "TRENDING PRODUCTS",
  fashion: "FASHION",
  beauty: "BEAUTY",
  accessories: "ACCESSORIES",
  fragrance: "FRAGRANCE",
  celebrity: "CELEBRITY STYLE",
  teen: "TEEN / HIGH SCHOOL",
  japan_brands: "JAPAN BRANDS",
};

export const PRODUCT_COLLECTION_HINTS: Record<ProductCollection, string> = {
  trending: "今週、日本で見つかっている人気商品",
  fashion: "洋服・トップス・スカート・スニーカー",
  beauty: "コスメ・スキンケア・ヘアケア",
  accessories: "バッグ・靴・アクセサリー",
  fragrance: "香水・コロン・オードパルファム",
  celebrity: "出典付きの芸能人愛用品",
  teen: "高校生調査で支持された店舗の定番商品",
  japan_brands: "日本ブランドの公式商品",
};

export type CelebrityRelation =
  | "愛用"
  | "着用"
  | "紹介"
  | "プロデュース"
  | "アンバサダー";

export type SourceKind =
  | "magazine"
  | "news"
  | "brand_official"
  | "official_sns"
  | "survey"
  | "press";

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  magazine: "雑誌・美容メディア",
  news: "ニュース",
  brand_official: "ブランド公式",
  official_sns: "公式SNS",
  survey: "調査",
  press: "プレスリリース",
};

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  collections: ProductCollection[];
  subcategory: string;
  subcategoryLabel: string;
  description: string;
  scentNotes?: string;
  imageUrl: string;
  accent: string;
  celebrityName: string | null;
  celebrityRelation: CelebrityRelation | null;
  sourceUrl: string;
  sourceTitle: string;
  sourceKind: SourceKind;
  purchaseUrl: string;
  purchaseLabel: string;
  seller: string;
  priceText: string | null;
  popularityScore: number;
  publishedAt: string;
  tags: string[];
};
