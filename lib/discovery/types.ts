export const DISCOVERY_CATEGORIES = [
  "fashion",
  "beauty",
  "accessories",
  "fragrance",
  "japan_brand",
  "celebrity_style",
  "anime_culture",
  "lifestyle",
  "food",
  "travel",
  "home",
  "tech",
  "sports",
  "other",
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_CATEGORY_LABELS: Record<DiscoveryCategory, string> = {
  fashion: "Fashion",
  beauty: "Beauty",
  accessories: "Accessories",
  fragrance: "Fragrance",
  japan_brand: "Japan Brand",
  celebrity_style: "Celebrity Style",
  anime_culture: "Anime / Culture",
  lifestyle: "Lifestyle",
  food: "Food",
  travel: "Travel",
  home: "Home",
  tech: "Tech",
  sports: "Sports",
  other: "Other",
};

export const TREND_TAGS = [
  "celebrity_pick",
  "viral",
  "trending",
  "rising",
  "new_release",
  "best_seller",
  "gen_z_trend",
  "world_trend",
  "japan_trend",
  "us_trend",
  "korea_trend",
  "uk_trend",
  "re_discovered",
  "editorial_pick",
  "hidden_gem",
  "luxury",
  "teen",
  "high_school",
  "y2k",
  "streetwear",
] as const;

export type TrendTag = (typeof TREND_TAGS)[number];

export const TREND_TAG_LABELS: Record<TrendTag, string> = {
  celebrity_pick: "Celebrity Pick",
  viral: "Viral",
  trending: "Trending",
  rising: "Rising",
  new_release: "New Release",
  best_seller: "Best Seller",
  gen_z_trend: "Gen Z Trend",
  world_trend: "World Trend",
  japan_trend: "Japan Trend",
  us_trend: "US Trend",
  korea_trend: "Korea Trend",
  uk_trend: "UK Trend",
  re_discovered: "Re-discovered",
  editorial_pick: "Editorial Pick",
  hidden_gem: "Hidden Gem",
  luxury: "Luxury",
  teen: "Teen",
  high_school: "High School",
  y2k: "Y2K",
  streetwear: "Streetwear",
};

export const DISCOVERY_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export const PERSON_TYPES = [
  "celebrity",
  "athlete",
  "creator",
  "influencer",
  "artist",
  "public_figure",
  "other",
] as const;
export type PersonType = (typeof PERSON_TYPES)[number];

export const PERSON_RELATIONS = [
  "worn",
  "used",
  "recommended",
  "mentioned",
  "featured",
  "spotted_wearing",
  "featured_in",
  "owned",
  "unknown",
] as const;
export type PersonRelation = (typeof PERSON_RELATIONS)[number];

export const PERSON_RELATION_LABELS: Record<PersonRelation, string> = {
  worn: "worn",
  used: "used",
  recommended: "recommended",
  mentioned: "mentioned",
  featured: "featured",
  spotted_wearing: "spotted wearing",
  featured_in: "featured in",
  owned: "owned",
  unknown: "unknown",
};

export const SOURCE_TYPES = [
  "brand_official",
  "retailer",
  "official_person",
  "magazine",
  "news",
  "editorial",
  "sns",
  "blog",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  brand_official: "Brand official",
  retailer: "Retailer",
  official_person: "Official person",
  magazine: "Magazine",
  news: "News",
  editorial: "Editorial",
  sns: "SNS",
  blog: "Blog",
  other: "Other",
};

export const SELLER_KINDS = ["official", "authorized", "retailer", "marketplace"] as const;
export type SellerKind = (typeof SELLER_KINDS)[number];

export type SourceTier = 1 | 2 | 3 | 4;

export type DiscoverySource = {
  id: string;
  sourceType: SourceType;
  sourceUrl: string;
  sourceTitle: string;
  sourceDomain: string | null;
  publishedAt: string | null;
  sourceExcerpt: string | null;
  verificationStatus: "unverified" | "verified" | "rejected";
  sourceTier: SourceTier;
  createdAt: string;
};

export type DiscoveryPerson = {
  id: string;
  personName: string;
  personType: PersonType;
  personUrl: string | null;
  personImageUrl: string | null;
  relation: PersonRelation;
  sourceId: string | null;
  createdAt: string;
};

export type DiscoverySale = {
  id: string;
  sellerName: string;
  productUrl: string;
  price: number | null;
  currency: string | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  officialStore: boolean;
  sellerKind: SellerKind;
  affiliateUrl: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
};

export type DiscoveryProduct = {
  id: string;
  brand: string;
  productName: string;
  category: DiscoveryCategory;
  subcategory: string;
  country: string | null;
  description: string;
  productImageUrl: string | null;
  productUrl: string | null;
  officialUrl: string | null;
  price: number | null;
  currency: string;
  sku: string | null;
  trendScore: number;
  confidenceScore: number;
  discoverySource: string | null;
  status: DiscoveryStatus;
  normalizedBrand: string;
  normalizedProductName: string;
  trendTags: TrendTag[];
  sources: DiscoverySource[];
  people: DiscoveryPerson[];
  sales: DiscoverySale[];
  createdAt: string;
  updatedAt: string;
};

export type DiscoveryProductInput = Omit<
  DiscoveryProduct,
  "normalizedBrand" | "normalizedProductName" | "createdAt" | "updatedAt"
> & {
  createdAt?: string;
  updatedAt?: string;
};
