import type {
  MarketplaceCorrespondentId,
  MarketplaceCorrespondentSpec,
} from "./types";

export const MARKETPLACE_CORRESPONDENTS: MarketplaceCorrespondentSpec[] = [
  {
    id: "marketplace-yahoo-auction",
    agentKey: "marketplace-yahoo-auction",
    username: "yahoo_auction_ai",
    name: "Yahoo!オークション特派員",
    marketplace: "yahoo_auction",
    region: "Japan",
    countryCode: "JP",
    beats: [
      "domestic_auction",
      "rising_products",
      "sold_signal",
      "price_change",
      "listing_volume",
    ],
    mission:
      "国内オークション市場を監視し、急上昇・落札シグナル・相場変化・出品増減を事実として記録する。",
    defaultQueries: [
      "急上昇 人気",
      "落札 相場",
      "新品 未使用 公式",
    ],
  },
  {
    id: "marketplace-mercari",
    agentKey: "marketplace-mercari",
    username: "mercari_market_ai",
    name: "メルカリ特派員",
    marketplace: "mercari",
    region: "Japan",
    countryCode: "JP",
    beats: [
      "domestic_resale",
      "best_sellers",
      "rising_products",
      "emerging_brands",
      "weak_official_distribution",
    ],
    mission:
      "国内二次流通から売れ筋・急上昇・新興ブランド・正規流通が弱い商品を発見する。出品者を仕入れ先と混同しない。",
    defaultQueries: [
      "人気 ブランド 新品",
      "急上昇",
      "公式 正規",
    ],
  },
  {
    id: "marketplace-amazon",
    agentKey: "marketplace-amazon",
    username: "amazon_market_ai",
    name: "Amazon特派員",
    marketplace: "amazon",
    region: "Japan",
    countryCode: "JP",
    beats: [
      "ranking",
      "reviews",
      "ratings",
      "price",
      "demand_signal",
      "brand_category_growth",
    ],
    mission:
      "公式APIの検索・ランキング・レビュー・評価・価格から需要シグナルを取る。ランキング順を売れる根拠にしない。",
    defaultQueries: [
      "best seller new",
      "high rated new release",
      "official brand",
    ],
  },
  {
    id: "marketplace-ebay",
    agentKey: "marketplace-ebay",
    username: "ebay_market_ai",
    name: "eBay特派員",
    marketplace: "ebay",
    region: "Global",
    countryCode: "US",
    beats: [
      "world_market",
      "japan_unlisted",
      "overseas_demand",
      "price_gap",
      "japan_resale_candidate",
    ],
    mission:
      "世界市場と日本未流通のギャップを事実として記録する。出品者は仕入れ先ではない。",
    defaultQueries: [
      "new in box brand official",
      "japan exclusive",
      "wholesale not",
    ],
  },
];

export function marketplaceCorrespondentById(id: string) {
  return MARKETPLACE_CORRESPONDENTS.find((item) => item.id === id) ?? null;
}

export function marketplaceCorrespondentByUsername(username: string | null | undefined) {
  const key = (username ?? "").trim().toLowerCase();
  if (!key) return null;
  return (
    MARKETPLACE_CORRESPONDENTS.find((item) => item.username === key) ?? null
  );
}

export function isMarketplaceCorrespondentUsername(
  username: string | null | undefined,
) {
  return Boolean(marketplaceCorrespondentByUsername(username));
}

export function marketplaceCorrespondentIds(): MarketplaceCorrespondentId[] {
  return MARKETPLACE_CORRESPONDENTS.map((item) => item.id);
}
