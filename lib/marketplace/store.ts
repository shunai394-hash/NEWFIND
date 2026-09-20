import { createAdminClient } from "@/lib/supabase/admin";
import { isAgentOsMissing } from "@/lib/ai/agent-os/store";
import type {
  CorrespondentLearningRecord,
  MarketplaceCorrespondentId,
  ProductDecision,
} from "./types";
import type { MarketplacePipelineResult } from "./pipeline";
import type { SupplierResearchResult } from "./supplier";

function missing(message: string) {
  return (
    isAgentOsMissing(message) ||
    /marketplace_|supplier_|product_evaluations|correspondent_learning|42P01|42703/i.test(
      message,
    )
  );
}

export type CorrespondentStatusRow = {
  correspondentId: MarketplaceCorrespondentId;
  lastSearchAt: string | null;
  discovered: number;
  strong: number;
  watch: number;
  investigate: number;
  disqualified: number;
  learningCount: number;
  sourceAccuracy: number | null;
  adapterEnabled: boolean | null;
  adapterReason: string | null;
};

export type MarketplaceDossier = {
  identityKey: string;
  discoveryProductId: string | null;
  evaluation: {
    decision: ProductDecision;
    scores: Record<string, number>;
    discoveryReason: string;
    demandReason: string;
    priceReason: string;
    whyNow: string;
    recommendedAction: string;
    confidence: number;
    facts: Array<{ text: string; sourceUrl: string | null }>;
    hypotheses: Array<{ text: string }>;
    riskFlags: string[];
    humanReview: string;
  } | null;
  observations: Array<{
    marketplace: string;
    price: number | null;
    currency: string | null;
    observedAt: string;
    reviewCount: number | null;
    rating: number | null;
    soldCount: number | null;
    listingCount: number | null;
    popularityRank: number | null;
  }>;
  suppliers: Array<Record<string, unknown>>;
  comparison: Array<Record<string, unknown>>;
  margin: Record<string, unknown> | null;
  inquiryDrafts: Array<Record<string, unknown>>;
};

export async function persistMarketplacePipeline(
  result: MarketplacePipelineResult,
  options?: { discoveryIds?: Map<string, string> },
) {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    for (const item of result.items) {
      const candidate = item.evaluation.candidate;
      const identityKey = item.evaluation.identityKey;
      const discoveryId = options?.discoveryIds?.get(identityKey) ?? null;
      const productRow = {
        identity_key: identityKey,
        marketplace: candidate.marketplace,
        external_product_id: candidate.externalProductId,
        title: candidate.title,
        brand: candidate.brand,
        category: candidate.category,
        url: candidate.url,
        image_url: candidate.imageUrl,
        gtin: candidate.gtin,
        sku: candidate.sku,
        asin: candidate.asin,
        epid: candidate.epid,
        correspondent_id: result.correspondentId,
        discovery_product_id: discoveryId,
        first_seen_at: candidate.firstSeenAt ?? candidate.observedAt,
        last_seen_at: candidate.lastSeenAt ?? candidate.observedAt,
        updated_at: now,
      };
      const upserted = await admin
        .from("marketplace_products")
        .upsert(productRow, { onConflict: "identity_key" })
        .select("id")
        .maybeSingle();
      if (upserted.error) {
        if (missing(upserted.error.message)) return { ok: false, reason: upserted.error.message };
        continue;
      }
      const productId = upserted.data?.id as string | undefined;
      if (!productId) continue;

      await admin.from("marketplace_observations").insert({
        product_id: productId,
        marketplace: candidate.marketplace,
        external_product_id: candidate.externalProductId,
        title: candidate.title,
        url: candidate.url,
        image_url: candidate.imageUrl,
        price: candidate.price,
        currency: candidate.currency,
        seller_name: candidate.sellerName,
        seller_type: candidate.sellerType,
        availability: candidate.availability,
        source_type: candidate.sourceType,
        source_confidence: candidate.sourceConfidence,
        sold_count: candidate.soldCount,
        transaction_signal: candidate.transactionSignal,
        listing_count: candidate.listingCount,
        review_count: candidate.reviewCount,
        rating: candidate.rating,
        popularity_rank: candidate.popularityRank,
        observed_at: candidate.observedAt,
        raw: candidate,
      });

      await admin.from("product_evaluations").insert({
        product_id: productId,
        correspondent_id: result.correspondentId,
        decision: item.evaluation.decision,
        product_score: item.evaluation.scores.productScore,
        scores: item.evaluation.scores,
        discovery_reason: item.evaluation.discoveryReason,
        demand_reason: item.evaluation.demandReason,
        price_reason: item.evaluation.priceReason,
        why_now: item.evaluation.whyNow,
        recommended_action: item.evaluation.recommendedAction,
        confidence: item.evaluation.confidence,
        facts: item.evaluation.factHypothesis.facts,
        hypotheses: item.evaluation.factHypothesis.hypotheses,
        risk_flags: item.evaluation.riskFlags,
        drop_reason: item.evaluation.dropReason,
        human_review: item.evaluation.humanReview,
        pricesense_qualification: item.pricesense,
      });

      if (item.suppliers) {
        await persistSupplierResearch(admin, productId, item.suppliers);
      }
    }

    if (result.learning.length) {
      await admin.from("correspondent_learning").insert(
        result.learning.map((row) => ({
          correspondent_id: row.correspondentId,
          query: row.query,
          marketplace: row.marketplace,
          identity_key: row.identityKey,
          candidate_title: row.candidateTitle,
          decision: row.decision,
          confidence: row.confidence,
          human_feedback: row.humanFeedback,
          actual_result: row.actualResult,
          rejection_reason: row.rejectionReason,
          supplier_result: row.supplierResult,
          eventual_sales_signal: row.eventualSalesSignal,
        })),
      );
    }
    return { ok: true as const, reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (missing(message)) return { ok: false as const, reason: message };
    console.warn("persist marketplace pipeline failed", message);
    return { ok: false as const, reason: message };
  }
}

async function persistSupplierResearch(
  admin: ReturnType<typeof createAdminClient>,
  productId: string,
  research: SupplierResearchResult,
) {
  const run = await admin
    .from("supplier_research_runs")
    .insert({
      product_id: productId,
      identity_key: research.identityKey,
      reused: research.reused,
      valid_until: research.validUntil,
      comparison: research.comparison,
      margin: research.margin,
      facts: research.factHypothesis.facts,
      hypotheses: research.factHypothesis.hypotheses,
      recommended_action: research.recommendedAction,
      human_review: research.humanReview,
      unavailable_reason: research.unavailableReason,
    })
    .select("id")
    .maybeSingle();
  if (run.error || !run.data?.id) return;
  const runId = run.data.id as string;
  for (const supplier of research.suppliers) {
    const inserted = await admin
      .from("supplier_candidates")
      .insert({
        research_run_id: runId,
        product_id: productId,
        supplier_name: supplier.supplierName,
        official_url: supplier.officialUrl,
        product_url: supplier.productUrl,
        supplier_type: supplier.supplierType,
        country: supplier.country,
        brand: supplier.brand,
        product_name: supplier.productName,
        product_match_confidence: supplier.productMatchConfidence,
        unit_price: supplier.unitPrice,
        currency: supplier.currency,
        price_min: supplier.priceMin,
        price_max: supplier.priceMax,
        price_breaks: supplier.priceBreaks,
        reference_retail_price: supplier.referenceRetailPrice,
        reference_retail_currency: supplier.referenceRetailCurrency,
        moq: supplier.moq,
        wholesale_available: supplier.wholesaleAvailable,
        bulk_discount: supplier.bulkDiscount,
        sample_available: supplier.sampleAvailable,
        stock_status: supplier.stockStatus,
        supply_continuity: supplier.supplyContinuity,
        lead_time: supplier.leadTime,
        restock_information: supplier.restockInformation,
        ships_to_japan: supplier.shipsToJapan,
        shipping_cost: supplier.shippingCost,
        shipping_method: supplier.shippingMethod,
        estimated_delivery: supplier.estimatedDelivery,
        payment_methods: supplier.paymentMethods,
        account_required: supplier.accountRequired,
        wholesale_application_required: supplier.wholesaleApplicationRequired,
        contact_url: supplier.contactUrl,
        contact_email: supplier.contactEmailIfPublic,
        authorized_status: supplier.authorizedStatus,
        brand_authorization_evidence: supplier.brandAuthorizationEvidence,
        risk_flags: supplier.riskFlags,
        source_url: supplier.sourceUrl,
        source_name: supplier.sourceName,
        evidence_text: supplier.evidenceText,
        observed_at: supplier.observedAt,
        confidence: supplier.confidence,
        valid_until: supplier.validUntil,
        facts: supplier.factHypothesis.facts,
        hypotheses: supplier.factHypothesis.hypotheses,
        recommended_action: supplier.recommendedAction,
        marketplace_seller: supplier.marketplaceSeller,
        scores: {
          supplierMatchScore: supplier.supplierMatchScore,
          supplyScore: supplier.supplyScore,
          priceScore: supplier.priceScore,
          riskScore: supplier.riskScore,
          overallSupplierConfidence: supplier.overallSupplierConfidence,
        },
      })
      .select("id")
      .maybeSingle();
    if (inserted.error) continue;
  }
  if (research.inquiryDrafts.length) {
    await admin.from("supplier_inquiry_drafts").insert(
      research.inquiryDrafts.map((draft) => ({
        product_id: productId,
        research_run_id: runId,
        supplier_name: draft.supplierName,
        official_url: draft.officialUrl,
        contact_url: draft.contactUrl,
        product_name: draft.productName,
        brand: draft.brand,
        subject: draft.subject,
        body: draft.body,
        send_status: draft.sendStatus,
      })),
    );
  }
}

export async function loadCorrespondentLearning(
  correspondentId: MarketplaceCorrespondentId,
): Promise<CorrespondentLearningRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("correspondent_learning")
      .select(
        "correspondent_id, query, marketplace, identity_key, candidate_title, decision, confidence, human_feedback, actual_result, rejection_reason, supplier_result, eventual_sales_signal, created_at",
      )
      .eq("correspondent_id", correspondentId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) return [];
    return (data ?? []).map((row) => ({
      correspondentId: row.correspondent_id,
      query: row.query,
      marketplace: row.marketplace,
      identityKey: row.identity_key,
      candidateTitle: row.candidate_title,
      decision: row.decision,
      confidence: row.confidence,
      humanFeedback: row.human_feedback,
      actualResult: row.actual_result,
      rejectionReason: row.rejection_reason,
      supplierResult: row.supplier_result,
      eventualSalesSignal: row.eventual_sales_signal,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function loadCachedSupplierResearch(
  identityKey: string,
): Promise<SupplierResearchResult | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("supplier_research_runs")
      .select("*")
      .eq("identity_key", identityKey)
      .gt("valid_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const suppliers = await admin
      .from("supplier_candidates")
      .select("*")
      .eq("research_run_id", data.id);
    return {
      identityKey,
      reused: true,
      validUntil: data.valid_until,
      suppliers: (suppliers.data ?? []).map(mapSupplierRow),
      comparison: Array.isArray(data.comparison) ? data.comparison : [],
      margin: data.margin ?? null,
      inquiryDrafts: [],
      factHypothesis: {
        facts: Array.isArray(data.facts) ? data.facts : [],
        hypotheses: Array.isArray(data.hypotheses) ? data.hypotheses : [],
      },
      humanReview: data.human_review ?? "pending_human",
      recommendedAction: data.recommended_action ?? "",
      unavailableReason: data.unavailable_reason ?? null,
    };
  } catch {
    return null;
  }
}

function mapSupplierRow(row: Record<string, unknown>) {
  const scores = (row.scores ?? {}) as Record<string, number>;
  return {
    supplierName: String(row.supplier_name ?? ""),
    officialUrl: (row.official_url as string | null) ?? null,
    productUrl: (row.product_url as string | null) ?? null,
    supplierType: (row.supplier_type as SupplierResearchResult["suppliers"][number]["supplierType"]) || "other_authorized",
    country: (row.country as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    productName: (row.product_name as string | null) ?? null,
    productMatchConfidence: Number(row.product_match_confidence ?? 0),
    unitPrice: (row.unit_price as number | null) ?? null,
    currency: (row.currency as string | null) ?? null,
    priceMin: (row.price_min as number | null) ?? null,
    priceMax: (row.price_max as number | null) ?? null,
    priceBreaks: Array.isArray(row.price_breaks) ? row.price_breaks : [],
    referenceRetailPrice: (row.reference_retail_price as number | null) ?? null,
    referenceRetailCurrency: (row.reference_retail_currency as string | null) ?? null,
    moq: (row.moq as number | null) ?? null,
    minimumOrderQuantity: (row.moq as number | null) ?? null,
    wholesaleAvailable: (row.wholesale_available as boolean | null) ?? null,
    bulkDiscount: (row.bulk_discount as boolean | null) ?? null,
    sampleAvailable: (row.sample_available as boolean | null) ?? null,
    stockStatus: (row.stock_status as string | null) ?? null,
    supplyContinuity: (row.supply_continuity as string | null) ?? null,
    leadTime: (row.lead_time as string | null) ?? null,
    restockInformation: (row.restock_information as string | null) ?? null,
    shipsToJapan: (row.ships_to_japan as boolean | null) ?? null,
    shippingCost: (row.shipping_cost as number | null) ?? null,
    shippingMethod: (row.shipping_method as string | null) ?? null,
    estimatedDelivery: (row.estimated_delivery as string | null) ?? null,
    paymentMethods: Array.isArray(row.payment_methods) ? row.payment_methods : null,
    accountRequired: (row.account_required as boolean | null) ?? null,
    wholesaleApplicationRequired:
      (row.wholesale_application_required as boolean | null) ?? null,
    contactUrl: (row.contact_url as string | null) ?? null,
    contactEmailIfPublic: (row.contact_email as string | null) ?? null,
    authorizedStatus:
      (row.authorized_status as SupplierResearchResult["suppliers"][number]["authorizedStatus"]) ||
      "unknown",
    brandAuthorizationEvidence:
      (row.brand_authorization_evidence as string | null) ?? null,
    supplierReputation: null,
    riskFlags: Array.isArray(row.risk_flags) ? (row.risk_flags as string[]) : [],
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceName: (row.source_name as string | null) ?? null,
    evidenceText: (row.evidence_text as string | null) ?? null,
    observedAt: String(row.observed_at ?? ""),
    confidence: Number(row.confidence ?? 0),
    researchedAt: String(row.observed_at ?? ""),
    validUntil: String(row.valid_until ?? ""),
    factHypothesis: {
      facts: Array.isArray(row.facts) ? row.facts : [],
      hypotheses: Array.isArray(row.hypotheses) ? row.hypotheses : [],
    },
    recommendedAction: String(row.recommended_action ?? ""),
    marketplaceSeller: Boolean(row.marketplace_seller),
    supplierMatchScore: Number(scores.supplierMatchScore ?? 0),
    supplyScore: Number(scores.supplyScore ?? 0),
    priceScore: Number(scores.priceScore ?? 0),
    riskScore: Number(scores.riskScore ?? 0),
    overallSupplierConfidence: Number(scores.overallSupplierConfidence ?? 0),
  };
}

export async function loadMarketplaceCorrespondentStatuses(): Promise<
  CorrespondentStatusRow[]
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_evaluations")
      .select("correspondent_id, decision, confidence, created_at")
      .order("created_at", { ascending: false })
      .limit(800);
    if (error) return [];
    const grouped = new Map<string, CorrespondentStatusRow>();
    for (const row of data ?? []) {
      const id = row.correspondent_id as MarketplaceCorrespondentId;
      const current = grouped.get(id) ?? {
        correspondentId: id,
        lastSearchAt: row.created_at as string,
        discovered: 0,
        strong: 0,
        watch: 0,
        investigate: 0,
        disqualified: 0,
        learningCount: 0,
        sourceAccuracy: null,
        adapterEnabled: null,
        adapterReason: null,
      };
      current.discovered += 1;
      if (row.decision === "STRONG_CANDIDATE" || row.decision === "CANDIDATE") {
        current.strong += 1;
      } else if (row.decision === "WATCH") current.watch += 1;
      else if (row.decision === "INVESTIGATE") current.investigate += 1;
      else if (row.decision === "DISQUALIFY") current.disqualified += 1;
      grouped.set(id, current);
    }
    const learning = await admin
      .from("correspondent_learning")
      .select("correspondent_id")
      .limit(2000);
    for (const row of learning.data ?? []) {
      const id = row.correspondent_id as MarketplaceCorrespondentId;
      const current = grouped.get(id);
      if (current) current.learningCount += 1;
    }
    return [...grouped.values()];
  } catch {
    return [];
  }
}

export async function loadMarketplaceDossier(input: {
  discoveryProductId?: string | null;
  identityKey?: string | null;
}): Promise<MarketplaceDossier | null> {
  try {
    const admin = createAdminClient();
    let productQuery = admin.from("marketplace_products").select("*").limit(1);
    if (input.discoveryProductId) {
      productQuery = productQuery.eq("discovery_product_id", input.discoveryProductId);
    } else if (input.identityKey) {
      productQuery = productQuery.eq("identity_key", input.identityKey);
    } else {
      return null;
    }
    const product = await productQuery.maybeSingle();
    if (product.error || !product.data) return null;
    const productId = product.data.id as string;
    const evalRow = await admin
      .from("product_evaluations")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const observations = await admin
      .from("marketplace_observations")
      .select("*")
      .eq("product_id", productId)
      .order("observed_at", { ascending: false })
      .limit(12);
    const run = await admin
      .from("supplier_research_runs")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const suppliers = run.data?.id
      ? await admin.from("supplier_candidates").select("*").eq("research_run_id", run.data.id)
      : { data: [] };
    const drafts = run.data?.id
      ? await admin
          .from("supplier_inquiry_drafts")
          .select("*")
          .eq("research_run_id", run.data.id)
      : { data: [] };
    const evaluation = evalRow.data
      ? {
          decision: evalRow.data.decision as ProductDecision,
          scores: (evalRow.data.scores ?? {}) as Record<string, number>,
          discoveryReason: String(evalRow.data.discovery_reason ?? ""),
          demandReason: String(evalRow.data.demand_reason ?? ""),
          priceReason: String(evalRow.data.price_reason ?? ""),
          whyNow: String(evalRow.data.why_now ?? ""),
          recommendedAction: String(evalRow.data.recommended_action ?? ""),
          confidence: Number(evalRow.data.confidence ?? 0),
          facts: Array.isArray(evalRow.data.facts) ? evalRow.data.facts : [],
          hypotheses: Array.isArray(evalRow.data.hypotheses)
            ? evalRow.data.hypotheses
            : [],
          riskFlags: Array.isArray(evalRow.data.risk_flags)
            ? evalRow.data.risk_flags
            : [],
          humanReview: String(evalRow.data.human_review ?? "pending_human"),
        }
      : null;
    return {
      identityKey: String(product.data.identity_key),
      discoveryProductId: (product.data.discovery_product_id as string | null) ?? null,
      evaluation,
      observations: (observations.data ?? []).map((row) => ({
        marketplace: String(row.marketplace ?? ""),
        price: (row.price as number | null) ?? null,
        currency: (row.currency as string | null) ?? null,
        observedAt: String(row.observed_at ?? ""),
        reviewCount: (row.review_count as number | null) ?? null,
        rating: (row.rating as number | null) ?? null,
        soldCount: (row.sold_count as number | null) ?? null,
        listingCount: (row.listing_count as number | null) ?? null,
        popularityRank: (row.popularity_rank as number | null) ?? null,
      })),
      suppliers: (suppliers.data ?? []) as Record<string, unknown>[],
      comparison: Array.isArray(run.data?.comparison) ? run.data.comparison : [],
      margin: (run.data?.margin as Record<string, unknown> | null) ?? null,
      inquiryDrafts: (drafts.data ?? []) as Record<string, unknown>[],
    };
  } catch {
    return null;
  }
}

export async function loadExistingMarketplaceKeys() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("marketplace_products")
      .select("identity_key")
      .limit(2000);
    if (error) return new Set<string>();
    return new Set((data ?? []).map((row) => String(row.identity_key)));
  } catch {
    return new Set<string>();
  }
}
