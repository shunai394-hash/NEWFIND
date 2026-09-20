import { hostOf, isHttpUrl } from "../adapters/common";
import type { SupplierSearchHit } from "./types";
import {
  COUNTERFEIT_SUPPLIER_HINT,
  MARKETPLACE_SELLER_HOST,
  type SupplierCandidate,
  type SupplierType,
} from "./types";

export function isMarketplaceSellerUrl(url: string) {
  const host = hostOf(url);
  return Boolean(host && MARKETPLACE_SELLER_HOST.test(host));
}

export function classifySupplierType(input: {
  url: string;
  title: string;
  snippet: string;
  brand: string | null;
}): { type: SupplierType; marketplaceSeller: boolean; riskFlags: string[] } {
  const url = input.url.toLowerCase();
  const text = `${input.title} ${input.snippet} ${url}`.toLowerCase();
  const riskFlags: string[] = [];
  if (isMarketplaceSellerUrl(input.url)) {
    return {
      type: "other_authorized",
      marketplaceSeller: true,
      riskFlags: ["marketplace_seller_not_supplier"],
    };
  }
  if (COUNTERFEIT_SUPPLIER_HINT.test(text)) {
    riskFlags.push("counterfeit_language");
  }
  if (/wholesale.?market|alibaba|made-in-china|dhgate/.test(text)) {
    riskFlags.push("unvetted_wholesale_marketplace");
    return { type: "wholesale_marketplace", marketplaceSeller: false, riskFlags };
  }
  if (/manufacturer|factory|made by|製造|メーカー/.test(text)) {
    return { type: "manufacturer", marketplaceSeller: false, riskFlags };
  }
  const brand = (input.brand ?? "").trim().toLowerCase();
  const host = hostOf(input.url);
  if (brand && host && host.replace(/[^a-z0-9]/g, "").includes(brand.replace(/[^a-z0-9]/g, "").slice(0, 8))) {
    return { type: "brand_official", marketplaceSeller: false, riskFlags };
  }
  if (/authorized.?distribut|exclusive.?distribut|正規代理|総代理/.test(text)) {
    return { type: "authorized_agent", marketplaceSeller: false, riskFlags };
  }
  if (/distributor|distribution/.test(text)) {
    return { type: "distributor", marketplaceSeller: false, riskFlags };
  }
  if (/wholesale|b2b|trade.?only|卸/.test(text)) {
    return { type: "wholesaler", marketplaceSeller: false, riskFlags };
  }
  if (/authorized.?reseller|official.?store/.test(text)) {
    return { type: "authorized_reseller", marketplaceSeller: false, riskFlags };
  }
  if (/\/(wholesale|trade|b2b|distributor)/.test(url)) {
    return { type: "wholesaler", marketplaceSeller: false, riskFlags };
  }
  return { type: "other_authorized", marketplaceSeller: false, riskFlags };
}

export function supplierSearchQueries(input: {
  brand: string | null;
  productName: string;
}) {
  const brand = (input.brand ?? "").trim();
  const product = input.productName.trim();
  const queries = [
    brand ? `${brand} official manufacturer wholesale` : null,
    brand ? `${brand} official distributor authorized` : null,
    brand ? `${brand} 公式 卸 正規代理店` : null,
    `${product} official wholesale`,
    brand ? `${brand} ${product} authorized distributor` : null,
  ].filter((item): item is string => Boolean(item));
  return [...new Set(queries)].slice(0, 4);
}

export function isUsableSupplierHit(hit: SupplierSearchHit, brand: string | null) {
  if (!isHttpUrl(hit.url)) return false;
  if (isMarketplaceSellerUrl(hit.url)) return false;
  if (COUNTERFEIT_SUPPLIER_HINT.test(`${hit.title} ${hit.snippet}`)) return false;
  const classified = classifySupplierType({
    url: hit.url,
    title: hit.title,
    snippet: hit.snippet,
    brand,
  });
  if (classified.marketplaceSeller) return false;
  if (classified.riskFlags.includes("counterfeit_language")) return false;
  return true;
}

export function emptySupplier(partial: Partial<SupplierCandidate> & Pick<SupplierCandidate, "supplierName" | "observedAt" | "researchedAt" | "validUntil">): SupplierCandidate {
  return {
    officialUrl: null,
    productUrl: null,
    supplierType: "other_authorized",
    country: null,
    brand: null,
    productName: null,
    productMatchConfidence: 0,
    unitPrice: null,
    currency: null,
    priceMin: null,
    priceMax: null,
    priceBreaks: [],
    referenceRetailPrice: null,
    referenceRetailCurrency: null,
    moq: null,
    minimumOrderQuantity: null,
    wholesaleAvailable: null,
    bulkDiscount: null,
    sampleAvailable: null,
    stockStatus: null,
    supplyContinuity: null,
    leadTime: null,
    restockInformation: null,
    shipsToJapan: null,
    shippingCost: null,
    shippingMethod: null,
    estimatedDelivery: null,
    paymentMethods: null,
    accountRequired: null,
    wholesaleApplicationRequired: null,
    contactUrl: null,
    contactEmailIfPublic: null,
    authorizedStatus: "unknown",
    brandAuthorizationEvidence: null,
    supplierReputation: null,
    riskFlags: [],
    sourceUrl: null,
    sourceName: null,
    evidenceText: null,
    confidence: 0,
    factHypothesis: { facts: [], hypotheses: [] },
    recommendedAction: "Human review required. Do not send outreach.",
    marketplaceSeller: false,
    supplierMatchScore: 0,
    supplyScore: 0,
    priceScore: 0,
    riskScore: 0,
    overallSupplierConfidence: 0,
    ...partial,
  };
}
