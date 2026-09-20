/**
 * Shared Marketplace Discovery Layer.
 * NEWFIND and PriceSense implement the same contract without merging databases.
 *
 * Product = what to sell
 * Supplier = where to source (never a marketplace seller)
 * Company/Prospect = who to sell to (PriceSense sales pipeline only)
 */

export const MARKETPLACES = [
  "yahoo_auction",
  "mercari",
  "amazon",
  "ebay",
] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  yahoo_auction: "Yahoo!オークション",
  mercari: "メルカリ",
  amazon: "Amazon",
  ebay: "eBay",
};

export const SOURCE_TYPES = [
  "official_api",
  "public_rss",
  "permitted_feed",
  "official_search_index",
  "unknown",
] as const;
export type MarketplaceSourceType = (typeof SOURCE_TYPES)[number];

export const SELLER_TYPES = [
  "marketplace_seller",
  "official_retailer",
  "authorized_reseller",
  "unknown",
] as const;
export type MarketplaceSellerType = (typeof SELLER_TYPES)[number];

export const AVAILABILITY_STATES = [
  "in_stock",
  "out_of_stock",
  "ended",
  "unknown",
] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export const PRODUCT_DECISIONS = [
  "STRONG_CANDIDATE",
  "CANDIDATE",
  "WATCH",
  "INVESTIGATE",
  "DISQUALIFY",
] as const;
export type ProductDecision = (typeof PRODUCT_DECISIONS)[number];

export const QUALIFICATION_DECISIONS = [
  "PURSUE",
  "WATCH",
  "INVESTIGATE",
  "DISQUALIFY",
] as const;
export type QualificationDecision = (typeof QUALIFICATION_DECISIONS)[number];

export const HUMAN_REVIEW_STATES = [
  "pending_human",
  "approved",
  "rejected",
  "not_required",
] as const;
export type HumanReviewState = (typeof HUMAN_REVIEW_STATES)[number];

export const LEARNING_FEEDBACK = [
  "GOOD_PRODUCT",
  "GOOD_SUPPLIER",
  "BAD_SUPPLIER",
  "WRONG_PRODUCT",
  "WRONG_MARKET",
  "WRONG_PRICE",
  "WRONG_DEMAND",
  "BAD_SOURCE",
  "SUPPLY_UNAVAILABLE",
  "COMPETITOR_TOO_STRONG",
  "LEGAL_RISK",
  "MOQ_TOO_HIGH",
  "MARGIN_TOO_LOW",
  "PRICE_CHANGED",
  "STOCK_LOST",
  "COUNTERFEIT_RISK",
  "NO_JAPAN_SHIPPING",
] as const;
export type LearningFeedback = (typeof LEARNING_FEEDBACK)[number];

export const DROP_REASONS = [
  "not_a_product",
  "news_article",
  "invalid_url",
  "duplicate_product",
  "existing_product",
  "missing_price",
  "missing_image",
  "unknown_source",
  "counterfeit_or_legal_risk",
  "adapter_disabled",
  "marketplace_seller_as_supplier",
  "insufficient_identity",
] as const;
export type DropReason = (typeof DROP_REASONS)[number];

export const SUPPLIER_TYPES = [
  "manufacturer",
  "brand_official",
  "authorized_agent",
  "distributor",
  "wholesaler",
  "wholesale_marketplace",
  "authorized_reseller",
  "other_authorized",
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const AUTHORIZED_STATUSES = [
  "authorized",
  "unknown",
  "unauthorized",
] as const;
export type AuthorizedStatus = (typeof AUTHORIZED_STATUSES)[number];

export const MARGIN_STATUSES = ["COMPLETE", "INCOMPLETE"] as const;
export type MarginStatus = (typeof MARGIN_STATUSES)[number];

export type PricePoint = {
  price: number;
  currency: string;
  observedAt: string;
};

export type PriceBreak = {
  minQuantity: number;
  unitPrice: number;
  currency: string;
};

export type ObservedFact = {
  text: string;
  sourceUrl: string | null;
  sourceName: string | null;
  observedAt: string;
};

export type ObservedHypothesis = {
  text: string;
  basedOnFactIndexes: number[];
};

export type FactHypothesisSplit = {
  facts: ObservedFact[];
  hypotheses: ObservedHypothesis[];
};

export type MarketplaceProductCandidate = {
  marketplace: Marketplace;
  externalProductId: string;
  title: string;
  brand: string | null;
  category: string | null;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  sellerName: string | null;
  sellerType: MarketplaceSellerType;
  availability: AvailabilityState;
  observedAt: string;
  sourceType: MarketplaceSourceType;
  sourceConfidence: number;
  soldCount: number | null;
  transactionSignal: string | null;
  listingCount: number | null;
  reviewCount: number | null;
  rating: number | null;
  priceHistory: PricePoint[];
  popularityRank: number | null;
  gtin: string | null;
  sku: string | null;
  asin: string | null;
  epid: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type ProductScorecard = {
  productIdentityConfidence: number;
  demandConfidence: number;
  priceConfidence: number;
  marketGapConfidence: number;
  sourceConfidence: number;
  resalePotential: number;
  importPotential: number;
  supplyPotential: number;
  riskScore: number;
  productScore: number;
};

export type ProductEvaluation = {
  identityKey: string;
  marketplace: Marketplace;
  candidate: MarketplaceProductCandidate;
  scores: ProductScorecard;
  decision: ProductDecision;
  discoveryReason: string;
  demandReason: string;
  priceReason: string;
  whyNow: string;
  recommendedAction: string;
  confidence: number;
  factHypothesis: FactHypothesisSplit;
  riskFlags: string[];
  dropReason: DropReason | null;
  existingProduct: boolean;
  humanReview: HumanReviewState;
};

export const CORRESPONDENT_IDS = [
  "marketplace-yahoo-auction",
  "marketplace-mercari",
  "marketplace-amazon",
  "marketplace-ebay",
] as const;
export type MarketplaceCorrespondentId = (typeof CORRESPONDENT_IDS)[number];

export type MarketplaceCorrespondentSpec = {
  id: MarketplaceCorrespondentId;
  agentKey: MarketplaceCorrespondentId;
  username: string;
  name: string;
  marketplace: Marketplace;
  region: string;
  countryCode: string;
  beats: string[];
  mission: string;
  defaultQueries: string[];
};

export type AdapterStatus = {
  marketplace: Marketplace;
  enabled: boolean;
  reason: string | null;
  sourceType: MarketplaceSourceType;
};

export type MarketplaceSearchQuery = {
  query: string;
  marketplace: Marketplace;
  correspondentId: MarketplaceCorrespondentId;
  language?: string;
  limit?: number;
};

export type MarketplaceSearchResult = {
  status: AdapterStatus;
  query: string;
  candidates: MarketplaceProductCandidate[];
  fetchedAt: string;
  unavailableReason: string | null;
};

export type CorrespondentGrowth = {
  learnedQueries: string[];
  learnedSources: string[];
  learnedCategories: string[];
  learnedBrands: string[];
  learnedNegativePatterns: string[];
  successfulPatterns: string[];
  failedPatterns: string[];
  confidenceCalibration: number;
};

export type CorrespondentLearningRecord = {
  correspondentId: MarketplaceCorrespondentId;
  query: string;
  marketplace: Marketplace;
  identityKey: string | null;
  candidateTitle: string | null;
  decision: ProductDecision | null;
  confidence: number | null;
  humanFeedback: LearningFeedback | null;
  actualResult: string | null;
  rejectionReason: DropReason | string | null;
  supplierResult: string | null;
  eventualSalesSignal: string | null;
  createdAt: string;
};

export type AdapterFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;
