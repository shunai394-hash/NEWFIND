import { hostOf } from "../adapters/common";
import type { MarketplaceProductCandidate } from "../types";
import { classifySupplierType, emptySupplier, isMarketplaceSellerUrl, isUsableSupplierHit, supplierSearchQueries } from "./classify";
import { extractSupplierFactsFromText } from "./extract";
import type {
  MarginBreakdown,
  SupplierCandidate,
  SupplierComparisonRow,
  SupplierInquiryDraft,
  SupplierResearchResult,
  SupplierSearchHit,
} from "./types";
import { SUPPLIER_TYPE_RANK } from "./types";

export type SupplierResearchDeps = {
  search: (query: string) => Promise<SupplierSearchHit[]>;
  fetchPage?: (url: string) => Promise<string | null>;
  now?: () => Date;
  cached?: SupplierResearchResult | null;
};

const SUPPLY_VALID_MS = 1000 * 60 * 60 * 24 * 14;
const PRICE_VALID_MS = 1000 * 60 * 60 * 24 * 3;

function iso(date: Date) {
  return date.toISOString();
}

function addMs(date: Date, ms: number) {
  return new Date(date.getTime() + ms).toISOString();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function supplierNameFromHit(hit: SupplierSearchHit) {
  const host = hostOf(hit.url);
  const title = hit.title.split(/[|-]/)[0]?.trim() ?? "";
  return title || host || "Unknown supplier";
}

export function scoreSupplier(candidate: SupplierCandidate): SupplierCandidate {
  const typeRank = SUPPLIER_TYPE_RANK[candidate.supplierType] ?? 0;
  const supplierMatchScore = clamp(
    typeRank * 12 +
      candidate.productMatchConfidence * 0.4 +
      (candidate.authorizedStatus === "authorized" ? 15 : 0) -
      (candidate.marketplaceSeller ? 80 : 0),
  );
  const supplyScore = clamp(
    (candidate.wholesaleAvailable ? 30 : 10) +
      (candidate.moq != null ? 15 : 0) +
      (candidate.shipsToJapan === true ? 20 : candidate.shipsToJapan === false ? 0 : 8) +
      (candidate.stockStatus ? 10 : 0) +
      (candidate.leadTime ? 10 : 0),
  );
  const priceScore =
    candidate.unitPrice != null
      ? 70
      : candidate.referenceRetailPrice != null
        ? 25
        : 10;
  const riskScore = clamp(
    candidate.riskFlags.length * 18 +
      (candidate.authorizedStatus === "unauthorized" ? 40 : 0) +
      (candidate.marketplaceSeller ? 50 : 0) +
      (candidate.supplierType === "wholesale_marketplace" ? 15 : 0),
  );
  const overall = clamp(
    supplierMatchScore * 0.4 +
      supplyScore * 0.25 +
      priceScore * 0.15 -
      riskScore * 0.2,
  );
  return {
    ...candidate,
    supplierMatchScore,
    supplyScore,
    priceScore,
    riskScore,
    overallSupplierConfidence: overall,
    confidence: overall,
  };
}

export function compareSuppliers(suppliers: SupplierCandidate[]): SupplierComparisonRow[] {
  return [...suppliers]
    .sort((a, b) => {
      const type = SUPPLIER_TYPE_RANK[b.supplierType] - SUPPLIER_TYPE_RANK[a.supplierType];
      if (type) return type;
      return b.overallSupplierConfidence - a.overallSupplierConfidence;
    })
    .map((item) => ({
      supplierName: item.supplierName,
      supplierType: item.supplierType,
      officialUrl: item.officialUrl,
      moq: item.moq,
      unitPrice: item.unitPrice,
      currency: item.currency,
      shipsToJapan: item.shipsToJapan,
      authorizedStatus: item.authorizedStatus,
      overallSupplierConfidence: item.overallSupplierConfidence,
      notes:
        item.unitPrice == null
          ? "Wholesale price unknown; not guessed"
          : `Stated unit price ${item.unitPrice} ${item.currency ?? ""}`.trim(),
    }));
}

export function estimateMargin(input: {
  salePrice: number | null;
  saleCurrency: string | null;
  supplier: SupplierCandidate | null;
}): MarginBreakdown {
  const unknown: string[] = [];
  const unitCost = input.supplier?.unitPrice ?? null;
  const unitCurrency = input.supplier?.currency ?? null;
  if (input.salePrice == null) unknown.push("sale_price");
  if (unitCost == null) unknown.push("unit_cost");
  if (input.supplier?.shippingCost == null) unknown.push("shipping");
  unknown.push("duty");
  unknown.push("selling_fees");
  const sameCurrency =
    input.saleCurrency &&
    unitCurrency &&
    input.saleCurrency === unitCurrency;
  if (input.salePrice != null && unitCost != null && !sameCurrency) {
    unknown.push("currency_conversion");
  }
  const complete =
    input.salePrice != null &&
    unitCost != null &&
    sameCurrency &&
    input.supplier?.shippingCost != null;
  if (!complete) {
    return {
      salePrice: input.salePrice,
      saleCurrency: input.saleCurrency,
      unitCost,
      unitCostCurrency: unitCurrency,
      shippingCost: input.supplier?.shippingCost ?? null,
      knownDuty: null,
      knownFees: null,
      unknownCosts: unknown,
      estimatedGrossMargin: null,
      marginStatus: "INCOMPLETE",
    };
  }
  const margin =
    (input.salePrice! - unitCost! - (input.supplier!.shippingCost ?? 0)) /
    input.salePrice!;
  return {
    salePrice: input.salePrice,
    saleCurrency: input.saleCurrency,
    unitCost,
    unitCostCurrency: unitCurrency,
    shippingCost: input.supplier!.shippingCost,
    knownDuty: null,
    knownFees: null,
    unknownCosts: ["duty", "selling_fees"],
    estimatedGrossMargin: Math.round(margin * 1000) / 10,
    marginStatus: "INCOMPLETE",
  };
}

export function buildInquiryDraft(input: {
  supplier: SupplierCandidate;
  productName: string;
  brand: string | null;
}): SupplierInquiryDraft {
  const name = input.productName;
  const brand = input.brand ? `${input.brand} ` : "";
  return {
    supplierName: input.supplier.supplierName,
    officialUrl: input.supplier.officialUrl,
    contactUrl: input.supplier.contactUrl || input.supplier.officialUrl,
    productName: name,
    brand: input.brand,
    subject: `Wholesale inquiry: ${brand}${name} (Japan distribution)`,
    body: [
      `Hello ${input.supplier.supplierName},`,
      "",
      `We are researching authorized wholesale supply for ${brand}${name} for planned sale in Japan.`,
      "This message is a draft only and must not be sent without human approval.",
      "",
      "Please confirm:",
      `1. Product match for ${brand}${name}`,
      "2. Whether wholesale pricing is available",
      "3. MOQ / minimum order quantity",
      "4. Whether you ship to Japan",
      "5. Lead time and restock policy",
      "6. Authorized distributor / brand authorization terms",
      "7. Sample availability",
      "",
      "Thank you.",
    ].join("\n"),
    sendStatus: "pending_human",
  };
}

function cacheFresh(cached: SupplierResearchResult, now: Date) {
  const until = Date.parse(cached.validUntil);
  return Number.isFinite(until) && until > now.getTime();
}

export async function researchSuppliers(
  product: MarketplaceProductCandidate,
  identityKey: string,
  deps: SupplierResearchDeps,
): Promise<SupplierResearchResult> {
  const now = deps.now?.() ?? new Date();
  if (deps.cached && cacheFresh(deps.cached, now)) {
    return { ...deps.cached, reused: true };
  }

  const queries = supplierSearchQueries({
    brand: product.brand,
    productName: product.title,
  });
  const hits: SupplierSearchHit[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const found = await deps.search(query);
    for (const hit of found) {
      const key = hit.url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }
  }

  const usable = hits.filter((hit) => isUsableSupplierHit(hit, product.brand));
  const suppliers: SupplierCandidate[] = [];
  const facts = [];
  const hypotheses = [];

  for (const hit of usable.slice(0, 6)) {
    if (isMarketplaceSellerUrl(hit.url)) continue;
    const classified = classifySupplierType({
      url: hit.url,
      title: hit.title,
      snippet: hit.snippet,
      brand: product.brand,
    });
    if (classified.marketplaceSeller) continue;
    const observedAt = iso(now);
    let candidate = emptySupplier({
      supplierName: supplierNameFromHit(hit),
      officialUrl: hit.url,
      productUrl: /product|item|sku|pd\//i.test(hit.url) ? hit.url : null,
      supplierType: classified.type,
      brand: product.brand,
      productName: product.title,
      productMatchConfidence: product.brand && hit.title.toLowerCase().includes(product.brand.toLowerCase())
        ? 70
        : 40,
      riskFlags: classified.riskFlags,
      sourceUrl: hit.url,
      sourceName: hit.sourceName ?? hostOf(hit.url),
      evidenceText: hit.snippet || hit.title,
      observedAt,
      researchedAt: observedAt,
      validUntil: addMs(now, PRICE_VALID_MS),
      authorizedStatus:
        classified.type === "brand_official" || classified.type === "manufacturer"
          ? "authorized"
          : classified.type === "wholesale_marketplace"
            ? "unknown"
            : "unknown",
      brandAuthorizationEvidence:
        classified.type === "brand_official" || classified.type === "manufacturer"
          ? "Official/manufacturer domain from search hit"
          : null,
      factHypothesis: {
        facts: [
          {
            text: `Search hit treated as supplier candidate: ${hit.title}`,
            sourceUrl: hit.url,
            sourceName: hit.sourceName ?? null,
            observedAt,
          },
        ],
        hypotheses: [],
      },
    });

    if (deps.fetchPage) {
      const html = await deps.fetchPage(hit.url);
      if (html) {
        const extracted = extractSupplierFactsFromText({
          htmlOrText: html,
          pageUrl: hit.url,
          observedAt,
        });
        candidate = {
          ...candidate,
          ...extracted.patch,
          factHypothesis: {
            facts: [...candidate.factHypothesis.facts, ...extracted.facts],
            hypotheses: candidate.factHypothesis.hypotheses,
          },
        };
      } else {
        candidate.factHypothesis.facts.push({
          text: "Supplier page body could not be fetched; missing fields left null",
          sourceUrl: hit.url,
          sourceName: hit.sourceName ?? null,
          observedAt,
        });
      }
    }

    if (candidate.unitPrice == null) {
      candidate.factHypothesis.facts.push({
        text: "Wholesale unit price was not stated; stored as unknown (not guessed)",
        sourceUrl: hit.url,
        sourceName: hit.sourceName ?? null,
        observedAt,
      });
      candidate.factHypothesis.hypotheses.push({
        text: "May offer wholesale after application; unconfirmed",
        basedOnFactIndexes: [0],
      });
    }
    if (candidate.shipsToJapan == null) {
      candidate.factHypothesis.hypotheses.push({
        text: "Japan shipping is unconfirmed",
        basedOnFactIndexes: [0],
      });
    }

    candidate.recommendedAction =
      candidate.unitPrice == null || candidate.moq == null
        ? "Prepare a supplier inquiry draft. Do not send it."
        : "Compare with other suppliers and wait for human review.";
    suppliers.push(scoreSupplier(candidate));
    facts.push(...candidate.factHypothesis.facts);
    hypotheses.push(...candidate.factHypothesis.hypotheses);
  }

  const uniqueTypes = new Set(suppliers.map((item) => item.supplierType));
  if (suppliers.length < 2) {
    hypotheses.push({
      text: "Fewer than two confirmed suppliers; comparison is incomplete",
      basedOnFactIndexes: facts.length ? [0] : [],
    });
  }

  const comparison = compareSuppliers(suppliers);
  const bestPriced = suppliers.find((item) => item.unitPrice != null) ?? null;
  const margin = estimateMargin({
    salePrice: product.price,
    saleCurrency: product.currency,
    supplier: bestPriced,
  });
  const inquiryDrafts = suppliers
    .filter(
      (item) =>
        item.unitPrice == null ||
        item.moq == null ||
        item.shipsToJapan == null,
    )
    .map((item) =>
      buildInquiryDraft({
        supplier: item,
        productName: product.title,
        brand: product.brand,
      }),
    );

  return {
    identityKey,
    reused: false,
    validUntil: addMs(now, SUPPLY_VALID_MS),
    suppliers,
    comparison,
    margin,
    inquiryDrafts,
    factHypothesis: { facts, hypotheses },
    humanReview: "pending_human",
    recommendedAction:
      suppliers.length === 0
        ? "No authorized supplier was confirmed. Do not use marketplace sellers as suppliers. Human review required."
        : "Compare suppliers. Do not send inquiries or place orders. Human confirmation required.",
    unavailableReason:
      suppliers.length === 0
        ? uniqueTypes.size === 0
          ? "no_authorized_supplier_found"
          : null
        : null,
  };
}
