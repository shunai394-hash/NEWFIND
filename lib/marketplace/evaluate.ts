import type {
  CorrespondentGrowth,
  CorrespondentLearningRecord,
  FactHypothesisSplit,
  MarketplaceProductCandidate,
  ObservedFact,
  ProductDecision,
  ProductEvaluation,
  ProductScorecard,
} from "./types";
import { marketplaceIdentityKey } from "./identity";
import { gateMarketplaceCandidate } from "./guard";

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fact(
  text: string,
  candidate: MarketplaceProductCandidate,
): ObservedFact {
  return {
    text,
    sourceUrl: candidate.url,
    sourceName: candidate.marketplace,
    observedAt: candidate.observedAt,
  };
}

export function emptyGrowth(): CorrespondentGrowth {
  return {
    learnedQueries: [],
    learnedSources: [],
    learnedCategories: [],
    learnedBrands: [],
    learnedNegativePatterns: [],
    successfulPatterns: [],
    failedPatterns: [],
    confidenceCalibration: 0,
  };
}

function applyLearningPenalty(
  candidate: MarketplaceProductCandidate,
  growth: CorrespondentGrowth,
) {
  let penalty = 0;
  const hay = `${candidate.title} ${candidate.brand ?? ""} ${candidate.category ?? ""}`.toLowerCase();
  for (const pattern of growth.learnedNegativePatterns) {
    if (pattern && hay.includes(pattern.toLowerCase())) penalty += 12;
  }
  for (const failed of growth.failedPatterns) {
    if (failed && hay.includes(failed.toLowerCase())) penalty += 8;
  }
  return Math.min(40, penalty);
}

function applyLearningBoost(
  candidate: MarketplaceProductCandidate,
  growth: CorrespondentGrowth,
) {
  let boost = 0;
  const hay = `${candidate.title} ${candidate.brand ?? ""} ${candidate.category ?? ""}`.toLowerCase();
  for (const brand of growth.learnedBrands) {
    if (brand && hay.includes(brand.toLowerCase())) boost += 8;
  }
  for (const pattern of growth.successfulPatterns) {
    if (pattern && hay.includes(pattern.toLowerCase())) boost += 6;
  }
  return Math.min(20, boost);
}

export function scoreMarketplaceCandidate(
  candidate: MarketplaceProductCandidate,
  options?: {
    japanListed?: boolean;
    growth?: CorrespondentGrowth;
    existing?: boolean;
  },
): ProductScorecard {
  const growth = options?.growth ?? emptyGrowth();
  let identity = 40;
  if (candidate.gtin || candidate.asin || candidate.epid) identity += 30;
  if (candidate.brand) identity += 15;
  if (candidate.sku) identity += 10;
  if (candidate.imageUrl) identity += 5;

  let demand = 20;
  if (candidate.soldCount && candidate.soldCount > 0) demand += 25;
  if (candidate.reviewCount && candidate.reviewCount >= 20) demand += 15;
  if (candidate.rating != null && candidate.rating >= 4) demand += 10;
  if (candidate.popularityRank != null && candidate.popularityRank <= 100) {
    demand += 10;
  }
  if (candidate.transactionSignal) demand += 8;
  // Ranking alone is not enough.
  if (
    candidate.popularityRank != null &&
    !candidate.soldCount &&
    !candidate.reviewCount &&
    !candidate.transactionSignal
  ) {
    demand = Math.min(demand, 45);
  }

  let priceConfidence = candidate.price != null ? 70 : 15;
  if (candidate.priceHistory.length >= 2) priceConfidence += 15;
  if (candidate.listingCount != null) priceConfidence += 5;

  let gap = 30;
  if (candidate.marketplace === "ebay" && options?.japanListed === false) {
    gap += 25;
  }
  if (candidate.marketplace === "mercari" || candidate.marketplace === "yahoo_auction") {
    gap += 10;
  }

  const source = candidate.sourceConfidence;
  let resale = Math.round((demand * 0.5 + priceConfidence * 0.3 + gap * 0.2));
  const importPotential =
    candidate.marketplace === "ebay" ? clamp(gap + 10) : clamp(gap - 10);
  let supply = 25;
  if (candidate.availability === "in_stock") supply += 10;
  if (candidate.listingCount && candidate.listingCount >= 3) supply += 10;

  let risk = 10;
  if (!candidate.imageUrl) risk += 10;
  if (candidate.price == null) risk += 10;
  if (candidate.sellerType === "marketplace_seller") risk += 8;
  if (options?.existing) risk += 5;
  risk += applyLearningPenalty(candidate, growth);
  const boost = applyLearningBoost(candidate, growth);
  demand = clamp(demand + boost);
  resale = clamp(resale + Math.round(boost / 2));

  const productScore = clamp(
    identity * 0.15 +
      demand * 0.22 +
      priceConfidence * 0.15 +
      gap * 0.12 +
      source * 0.12 +
      resale * 0.08 +
      importPotential * 0.08 +
      supply * 0.08 -
      risk * 0.15,
  );

  return {
    productIdentityConfidence: clamp(identity),
    demandConfidence: clamp(demand),
    priceConfidence: clamp(priceConfidence),
    marketGapConfidence: clamp(gap),
    sourceConfidence: clamp(source),
    resalePotential: clamp(resale),
    importPotential: clamp(importPotential),
    supplyPotential: clamp(supply),
    riskScore: clamp(risk),
    productScore,
  };
}

export function decideSellability(scores: ProductScorecard): ProductDecision {
  if (scores.riskScore >= 70) return "DISQUALIFY";
  if (scores.sourceConfidence < 40) return "DISQUALIFY";
  if (scores.productIdentityConfidence < 35) return "INVESTIGATE";
  if (
    scores.productScore >= 72 &&
    scores.demandConfidence >= 55 &&
    scores.priceConfidence >= 50 &&
    scores.riskScore < 45
  ) {
    return "STRONG_CANDIDATE";
  }
  if (scores.productScore >= 58 && scores.demandConfidence >= 40) {
    return "CANDIDATE";
  }
  if (scores.productScore >= 45) return "WATCH";
  return "INVESTIGATE";
}

export function shouldStartSupplierResearch(evaluation: ProductEvaluation) {
  return (
    (evaluation.decision === "STRONG_CANDIDATE" ||
      evaluation.decision === "CANDIDATE") &&
    evaluation.scores.productScore >= 58 &&
    evaluation.dropReason == null
  );
}

export function evaluateMarketplaceCandidate(
  candidate: MarketplaceProductCandidate,
  options?: {
    japanListed?: boolean;
    growth?: CorrespondentGrowth;
    existingKeys?: Set<string>;
  },
): ProductEvaluation {
  const identityKey = marketplaceIdentityKey(candidate);
  const existing = options?.existingKeys?.has(identityKey) ?? false;
  const gate = gateMarketplaceCandidate(candidate);
  const scores = scoreMarketplaceCandidate(candidate, {
    japanListed: options?.japanListed,
    growth: options?.growth,
    existing,
  });
  const facts: ObservedFact[] = [
    fact(
      `Marketplace listing observed on ${candidate.marketplace}: ${candidate.title}`,
      candidate,
    ),
  ];
  if (candidate.price != null && candidate.currency) {
    facts.push(
      fact(
        `Listed price ${candidate.price} ${candidate.currency} at ${candidate.observedAt}`,
        candidate,
      ),
    );
  } else {
    facts.push(fact("Listed price was not provided by the source", candidate));
  }
  if (candidate.reviewCount != null) {
    facts.push(fact(`Review count ${candidate.reviewCount}`, candidate));
  }
  if (candidate.soldCount != null) {
    facts.push(fact(`Transaction/sold signal count ${candidate.soldCount}`, candidate));
  }
  if (candidate.imageUrl) {
    facts.push(fact("Product image URL was provided by the source", candidate));
  } else {
    facts.push(fact("Product image URL was not provided", candidate));
  }

  const hypotheses = [];
  if (candidate.marketplace === "ebay") {
    hypotheses.push({
      text: "May be under-distributed in Japan if no matching JP listing is confirmed",
      basedOnFactIndexes: [0],
    });
  }
  if (scores.demandConfidence >= 50 && candidate.soldCount == null) {
    hypotheses.push({
      text: "Demand is inferred from ranking/reviews, not from a confirmed sold count",
      basedOnFactIndexes: candidate.reviewCount != null ? [2] : [0],
    });
  }

  const factHypothesis: FactHypothesisSplit = { facts, hypotheses };
  if (!gate.ok) {
    const decision =
      gate.reason === "existing_product" ? "WATCH" : "DISQUALIFY";
    return {
      identityKey,
      marketplace: candidate.marketplace,
      candidate,
      scores: { ...scores, productScore: Math.min(scores.productScore, 40) },
      decision,
      discoveryReason: `Dropped before sellability scoring: ${gate.reason}`,
      demandReason: "Not scored as a sellable candidate",
      priceReason:
        candidate.price == null
          ? "Price not provided by source"
          : `Source price ${candidate.price} ${candidate.currency ?? ""}`.trim(),
      whyNow: "No qualified why-now; candidate failed the product gate",
      recommendedAction: "Do not treat as a product opportunity. Human review if the drop was unexpected.",
      confidence: Math.min(scores.sourceConfidence, 30),
      factHypothesis,
      riskFlags: gate.reason ? [gate.reason] : [],
      dropReason: gate.reason,
      existingProduct: existing || gate.reason === "existing_product",
      humanReview: "pending_human",
    };
  }

  let decision = decideSellability(scores);
  if (existing && decision === "STRONG_CANDIDATE") decision = "CANDIDATE";
  if (candidate.price == null && decision === "STRONG_CANDIDATE") {
    decision = "CANDIDATE";
  }
  if (!candidate.imageUrl && decision === "STRONG_CANDIDATE") {
    decision = "CANDIDATE";
  }

  return {
    identityKey,
    marketplace: candidate.marketplace,
    candidate,
    scores,
    decision,
    discoveryReason: `Observed on ${candidate.marketplace} with identity ${identityKey}`,
    demandReason:
      candidate.soldCount || candidate.reviewCount || candidate.transactionSignal
        ? `Demand signals present (sold=${candidate.soldCount ?? "unknown"}, reviews=${candidate.reviewCount ?? "unknown"}, rank=${candidate.popularityRank ?? "unknown"}). Ranking alone is not treated as proof.`
        : "No sold/review/transaction signal; demand is incomplete",
    priceReason:
      candidate.price == null
        ? "Price not provided; price confidence is low and is not guessed"
        : `Observed list price ${candidate.price} ${candidate.currency ?? ""}`,
    whyNow: `${candidate.marketplace} observation at ${candidate.observedAt}`,
    recommendedAction:
      decision === "STRONG_CANDIDATE" || decision === "CANDIDATE"
        ? "Start supplier research. Do not contact anyone. Wait for human review after supplier comparison."
        : decision === "WATCH"
          ? "Keep watching. Do not start sales outreach."
          : "Investigate missing facts. Do not assert sellability.",
    confidence: clamp(
      scores.productScore * 0.7 + scores.sourceConfidence * 0.3,
    ),
    factHypothesis,
    riskFlags: scores.riskScore >= 40 ? ["elevated_risk"] : [],
    dropReason: null,
    existingProduct: existing,
    humanReview: "pending_human",
  };
}

export function growthFromLearning(
  records: CorrespondentLearningRecord[],
): CorrespondentGrowth {
  const growth = emptyGrowth();
  for (const record of records) {
    if (record.query && !growth.learnedQueries.includes(record.query)) {
      growth.learnedQueries.push(record.query);
    }
    if (record.marketplace && !growth.learnedSources.includes(record.marketplace)) {
      growth.learnedSources.push(record.marketplace);
    }
    const feedback = record.humanFeedback;
    const title = (record.candidateTitle ?? "").trim();
    if (feedback === "GOOD_PRODUCT" && title) {
      growth.successfulPatterns.push(title.slice(0, 80));
    }
    if (
      feedback === "WRONG_MARKET" ||
      feedback === "WRONG_PRODUCT" ||
      feedback === "WRONG_DEMAND" ||
      feedback === "COMPETITOR_TOO_STRONG"
    ) {
      if (title) growth.failedPatterns.push(title.slice(0, 80));
      if (title) growth.learnedNegativePatterns.push(title.slice(0, 40));
    }
    if (feedback === "COUNTERFEIT_RISK" || feedback === "LEGAL_RISK") {
      growth.learnedNegativePatterns.push("replica");
    }
    if (feedback === "GOOD_PRODUCT") growth.confidenceCalibration += 2;
    if (feedback === "WRONG_DEMAND" || feedback === "WRONG_MARKET") {
      growth.confidenceCalibration -= 3;
    }
  }
  growth.learnedQueries = growth.learnedQueries.slice(-24);
  growth.learnedSources = growth.learnedSources.slice(-12);
  growth.successfulPatterns = growth.successfulPatterns.slice(-20);
  growth.failedPatterns = growth.failedPatterns.slice(-20);
  growth.learnedNegativePatterns = growth.learnedNegativePatterns.slice(-20);
  growth.confidenceCalibration = Math.max(
    -20,
    Math.min(20, growth.confidenceCalibration),
  );
  return growth;
}

export function nextQueries(
  defaults: string[],
  growth: CorrespondentGrowth,
) {
  const recent = new Set(growth.learnedQueries.slice(-6).map((item) => item.toLowerCase()));
  const fresh = defaults.filter((query) => !recent.has(query.toLowerCase()));
  const extra = growth.successfulPatterns
    .slice(0, 2)
    .map((item) => item.split(" ").slice(0, 4).join(" "))
    .filter(Boolean);
  const merged = [...fresh, ...extra, ...defaults];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const query of merged) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= 3) break;
  }
  return out;
}
