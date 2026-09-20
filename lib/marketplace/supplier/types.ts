import type {
  AuthorizedStatus,
  FactHypothesisSplit,
  HumanReviewState,
  MarginStatus,
  PriceBreak,
  SupplierType,
} from "../types";

export type { AuthorizedStatus, SupplierType };

export type SupplierSearchHit = {
  title: string;
  url: string;
  snippet: string;
  sourceName?: string | null;
};

export type SupplierCandidate = {
  supplierName: string;
  officialUrl: string | null;
  productUrl: string | null;
  supplierType: SupplierType;
  country: string | null;
  brand: string | null;
  productName: string | null;
  productMatchConfidence: number;
  unitPrice: number | null;
  currency: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceBreaks: PriceBreak[];
  referenceRetailPrice: number | null;
  referenceRetailCurrency: string | null;
  moq: number | null;
  minimumOrderQuantity: number | null;
  wholesaleAvailable: boolean | null;
  bulkDiscount: boolean | null;
  sampleAvailable: boolean | null;
  stockStatus: string | null;
  supplyContinuity: string | null;
  leadTime: string | null;
  restockInformation: string | null;
  shipsToJapan: boolean | null;
  shippingCost: number | null;
  shippingMethod: string | null;
  estimatedDelivery: string | null;
  paymentMethods: string[] | null;
  accountRequired: boolean | null;
  wholesaleApplicationRequired: boolean | null;
  contactUrl: string | null;
  contactEmailIfPublic: string | null;
  authorizedStatus: AuthorizedStatus;
  brandAuthorizationEvidence: string | null;
  supplierReputation: string | null;
  riskFlags: string[];
  sourceUrl: string | null;
  sourceName: string | null;
  evidenceText: string | null;
  observedAt: string;
  confidence: number;
  researchedAt: string;
  validUntil: string;
  factHypothesis: FactHypothesisSplit;
  recommendedAction: string;
  marketplaceSeller: boolean;
  supplierMatchScore: number;
  supplyScore: number;
  priceScore: number;
  riskScore: number;
  overallSupplierConfidence: number;
};

export type SupplierComparisonRow = {
  supplierName: string;
  supplierType: SupplierType;
  officialUrl: string | null;
  moq: number | null;
  unitPrice: number | null;
  currency: string | null;
  shipsToJapan: boolean | null;
  authorizedStatus: AuthorizedStatus;
  overallSupplierConfidence: number;
  notes: string;
};

export type MarginBreakdown = {
  salePrice: number | null;
  saleCurrency: string | null;
  unitCost: number | null;
  unitCostCurrency: string | null;
  shippingCost: number | null;
  knownDuty: number | null;
  knownFees: number | null;
  unknownCosts: string[];
  estimatedGrossMargin: number | null;
  marginStatus: MarginStatus;
};

export type SupplierInquiryDraft = {
  supplierName: string;
  officialUrl: string | null;
  contactUrl: string | null;
  productName: string;
  brand: string | null;
  subject: string;
  body: string;
  sendStatus: HumanReviewState;
};

export type SupplierResearchResult = {
  identityKey: string;
  reused: boolean;
  validUntil: string;
  suppliers: SupplierCandidate[];
  comparison: SupplierComparisonRow[];
  margin: MarginBreakdown | null;
  inquiryDrafts: SupplierInquiryDraft[];
  factHypothesis: FactHypothesisSplit;
  humanReview: HumanReviewState;
  recommendedAction: string;
  unavailableReason: string | null;
};

export const SUPPLIER_TYPE_RANK: Record<SupplierType, number> = {
  manufacturer: 7,
  brand_official: 6,
  authorized_agent: 5,
  distributor: 4,
  wholesaler: 3,
  wholesale_marketplace: 2,
  authorized_reseller: 1,
  other_authorized: 0,
};

export const MARKETPLACE_SELLER_HOST =
  /(^|\.)(ebay\.|mercari\.|amazon\.|auctions\.yahoo\.|yahoo\.co\.jp|paypayfleamarket\.|rakuma\.rakuten|aliexpress\.|alibaba\.|dhgate\.|temu\.|shein\.)/i;

export const COUNTERFEIT_SUPPLIER_HINT =
  /\b(replica|counterfeit|fake|unauthorized|スーパーコピー|偽物|コピー品)\b/i;
