import type {
  QualificationDecision,
  ProductEvaluation,
} from "./types";
import type { SupplierResearchResult } from "./supplier";
import { evaluateSalesTarget, type SalesTargetInput } from "@/lib/ai/entity-verification";

/**
 * PriceSense product opportunity — never a Lead / Prospect / Company.
 * Existing sales-pipeline entities must not be ingested here.
 */
export type ProductOpportunityKind =
  | "product"
  | "supplier"
  | "product_opportunity";

export type PricesenseQualification = {
  entityKind: ProductOpportunityKind;
  decision: QualificationDecision;
  reason: string;
  productDecision: ProductEvaluation["decision"];
  hasSupplier: boolean;
  humanReview: "pending_human";
  recommendedAction: string;
  whyNow: string;
  factHypothesis: ProductEvaluation["factHypothesis"];
  notALead: true;
  notAProspect: true;
};

export function qualifyForPricesense(input: {
  evaluation: ProductEvaluation;
  suppliers: SupplierResearchResult | null;
}): PricesenseQualification {
  const hasSupplier = Boolean(input.suppliers?.suppliers.length);
  const decision = input.evaluation.decision;
  let qualification: QualificationDecision = "INVESTIGATE";
  let reason = "Needs more facts before any sales conversation";
  if (decision === "DISQUALIFY") {
    qualification = "DISQUALIFY";
    reason = input.evaluation.dropReason || input.evaluation.discoveryReason;
  } else if (decision === "WATCH") {
    qualification = "WATCH";
    reason = "Watch the market; do not create a sales lead";
  } else if (
    (decision === "STRONG_CANDIDATE" || decision === "CANDIDATE") &&
    hasSupplier
  ) {
    qualification = "PURSUE";
    reason =
      "Product may be commercially interesting and at least one non-marketplace supplier was found. Human confirmation required before any outreach.";
  } else if (decision === "STRONG_CANDIDATE" || decision === "CANDIDATE") {
    qualification = "INVESTIGATE";
    reason =
      "Product passed market evaluation but authorized supply is unconfirmed. Do not pursue as a sales lead.";
  }

  return {
    entityKind: "product_opportunity",
    decision: qualification,
    reason,
    productDecision: decision,
    hasSupplier,
    humanReview: "pending_human",
    recommendedAction:
      qualification === "PURSUE"
        ? "Human reviews product + suppliers. Do not email, order, or create a Lead/Prospect yet."
        : "Keep as product research. Do not mix into the company sales pipeline.",
    whyNow: input.evaluation.whyNow,
    factHypothesis: input.evaluation.factHypothesis,
    notALead: true,
    notAProspect: true,
  };
}

export function isExistingSalesEntity(input: SalesTargetInput) {
  const decision = evaluateSalesTarget(input);
  return decision.status === "skip" || Boolean(input.previousStatus);
}

export function rejectSalesEntityAsProduct(input: SalesTargetInput) {
  return {
    allowed: false as const,
    entityKind: "company" as const,
    reason: "Existing Lead/Prospect/Company must not enter marketplace product discovery",
    salesDecision: evaluateSalesTarget(input),
  };
}
