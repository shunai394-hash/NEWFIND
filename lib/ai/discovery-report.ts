export type DiscoveryReport = {
  brand: string;
  productName: string;
  category: string;
  subcategory: string;
  country: string | null;
  productUrl: string;
  officialUrl: string | null;
  productImageUrl: string | null;
  price: number | null;
  currency: string;
  launchDate: string | null;
  sku: string | null;
  gtin: string | null;
  modelNumber: string | null;
  canonicalUrl: string | null;
  sourceUrls: string[];
  evidence: string[];
  whyNow: string;
  whyThisResident: string;
  trendSignals: string[];
  noveltyScore: number;
  evidenceScore: number;
  residentFitScore: number;
  humanInterestScore: number;
  duplicateRisk: number;
  confidenceScore: number;
};

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function emptyDiscoveryReport(
  partial: Partial<DiscoveryReport> &
    Pick<DiscoveryReport, "brand" | "productName" | "productUrl">,
): DiscoveryReport {
  return {
    category: "other",
    subcategory: "",
    country: null,
    officialUrl: null,
    productImageUrl: null,
    price: null,
    currency: "USD",
    launchDate: null,
    sku: null,
    gtin: null,
    modelNumber: null,
    canonicalUrl: null,
    sourceUrls: [],
    evidence: [],
    whyNow: "",
    whyThisResident: "",
    trendSignals: [],
    noveltyScore: 0,
    evidenceScore: 0,
    residentFitScore: 0,
    humanInterestScore: 0,
    duplicateRisk: 0,
    confidenceScore: 0,
    ...partial,
  };
}

export function scoreDiscoveryEvidence(report: Pick<
  DiscoveryReport,
  | "productUrl"
  | "officialUrl"
  | "productImageUrl"
  | "price"
  | "sku"
  | "gtin"
  | "modelNumber"
  | "sourceUrls"
  | "evidence"
  | "launchDate"
>): number {
  let score = 0;
  if (report.productUrl) score += 20;
  if (report.officialUrl) score += 10;
  if (report.productImageUrl) score += 20;
  if (report.price != null) score += 10;
  if (report.sku || report.gtin || report.modelNumber) score += 15;
  if (report.launchDate) score += 5;
  if (report.sourceUrls.length >= 2) score += 10;
  if (report.evidence.length >= 2) score += 10;
  return clampScore(score);
}

export function isPostableDiscovery(report: DiscoveryReport) {
  if (!report.productUrl || !report.productImageUrl) return false;
  if (!report.brand.trim() || !report.productName.trim()) return false;
  if (report.evidenceScore < 50) return false;
  if (report.confidenceScore < 55) return false;
  if (report.residentFitScore < 45) return false;
  if (report.duplicateRisk >= 80) return false;
  return true;
}
