import type { DiscoveryProduct } from "@/lib/discovery/types";

export const TARGET_GROSS_MARGIN = 0.5;

export type ProfitabilityResult = {
  status: "needs_review" | "profitable" | "below_target" | "uncompetitive";
  supplierCostJPY: number | null;
  shippingCostJPY: number | null;
  requiredSellingPriceJPY: number | null;
  sellingPriceJPY: number | null;
  competitorPriceJPY: number | null;
  platformFeeRate: number | null;
  otherCostJPY: number | null;
  grossProfitJPY: number | null;
  grossMargin: number | null;
};

/**
 * Evaluate resale economics only from explicit, sourced commercial fields.
 * Product.price is an external reference price and is never treated as our revenue.
 */
export function evaluateProductProfitability(product: Pick<DiscoveryProduct, "commercial">): ProfitabilityResult {
  const data = product.commercial;
  const supplierCostJPY = data?.supplierCostJPY ?? null;
  const shippingCostJPY = data?.shippingCostJPY ?? null;
  const sellingPriceJPY = data?.sellingPriceJPY ?? null;
  const competitorPriceJPY = data?.competitorPriceJPY ?? null;
  const platformFeeRate = data?.platformFeeRate ?? null;
  const otherCostJPY = data?.otherCostJPY ?? null;
  const validCosts = [supplierCostJPY, shippingCostJPY, otherCostJPY].every(
    (value) => value !== null && Number.isFinite(value) && value >= 0,
  );
  const validFee = platformFeeRate !== null && Number.isFinite(platformFeeRate) && platformFeeRate >= 0 && platformFeeRate < 1;
  if (!data?.lastVerifiedAt || !data.sourceUrl || !validCosts || !validFee) {
    return { status: "needs_review", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY: null, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY: null, grossMargin: null };
  }

  const landedCost = supplierCostJPY! + shippingCostJPY! + otherCostJPY!;
  const denominator = 1 - platformFeeRate! - TARGET_GROSS_MARGIN;
  const requiredSellingPriceJPY = denominator > 0 ? Math.ceil(landedCost / denominator) : null;
  if (sellingPriceJPY === null || !Number.isFinite(sellingPriceJPY) || sellingPriceJPY <= 0) {
    return { status: "needs_review", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY: null, grossMargin: null };
  }
  if (requiredSellingPriceJPY === null) {
    return { status: "needs_review", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY: null, grossMargin: null };
  }
  const grossProfitJPY = sellingPriceJPY * (1 - platformFeeRate!) - landedCost;
  const grossMargin = grossProfitJPY / sellingPriceJPY;
  if (grossMargin < TARGET_GROSS_MARGIN) {
    return { status: "below_target", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY, grossMargin };
  }
  if (competitorPriceJPY !== null && Number.isFinite(competitorPriceJPY) && sellingPriceJPY > competitorPriceJPY) {
    return { status: "uncompetitive", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY, grossMargin };
  }
  return { status: "profitable", supplierCostJPY, shippingCostJPY, requiredSellingPriceJPY, sellingPriceJPY, competitorPriceJPY, platformFeeRate, otherCostJPY, grossProfitJPY, grossMargin };
}
