import {
  isNewsSignal,
  isProductSource,
  searchWorld,
  type WorldSearchResult,
} from "./world-search";
import {
  evaluateProductCandidates,
  type ProductHunterCandidate,
} from "./product-hunter";
import type { AiPersona } from "../ai-post-engine";
import { listDiscoveryProductsFromDb, saveDiscoveryProductToDb } from "@/lib/discovery/db";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryProductInput } from "@/lib/discovery/types";
import { prepareDiscoveryProduct } from "@/lib/discovery/rules";
import { classifyProductMatch, coreProductName } from "@/lib/ai/product-identity";
import { getSpecialistHunterByUsername } from "@/lib/ai/specialist-product-hunters";
import { getHunterStrategy } from "@/lib/ai/hunter-strategies";
import { planNextHunt } from "@/lib/ai/explore-next";
import { buildPrecisionHuntQueries } from "@/lib/ai/hunter-queries";
import { loadResidentHumanSignals } from "@/lib/ai/human-signals";
import { resultFitsHunterSpecialty } from "@/lib/ai/specialty-fit";
import {
  classifySearchRoles,
  createPipelineTrace,
  funnelSummary,
  markPipelineEvent,
  recordDrop,
} from "@/lib/ai/pipeline-trace";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  buildSelfState,
  decideTowardProduct,
  shouldSaveNow,
  shouldSearchNow,
  type Experience,
  type Intent,
  type SelfState,
} from "@/lib/ai/self-model";
import { isMarketplaceCorrespondentUsername } from "@/lib/marketplace/correspondents";
import {
  runNewfindMarketplaceHunt,
  type NewfindMarketplaceHuntResult,
} from "@/lib/marketplace/newfind";
import { emptyDiscoveryReport } from "@/lib/ai/discovery-report";
import { listAssignedDiscoveries } from "@/lib/ai/discovery-handoff";
import { loadOpenInvestigations, upsertInvestigation } from "@/lib/ai/investigations";
import { productIdentityKey } from "@/lib/ai/product-identity";
import type { ExplorationQuest } from "@/lib/ai/today-exploration";

export type ResidentProductHunterDiscovery = {
  candidateIndex: number;
  discoveryProductId: string;
};

export type ResidentProductHunterResult = {
  residentId: string;
  residentName: string;
  searchQuery: string;
  searchResults: WorldSearchResult[];
  worldNews: WorldSearchResult[];
  candidates: ProductHunterCandidate[];
  savedProductIds: string[];
  discoveries: ResidentProductHunterDiscovery[];
  funnelSummary?: string;
  intent?: Intent;
  decisions?: Array<{ product: string; decision: string; reason: string }>;
  searchPasses?: number;
  newResultCount?: number;
  explorationAxis?: string;
};

function marketplaceHuntAsHunterResult(
  persona: AiPersona,
  hunt: NewfindMarketplaceHuntResult,
): ResidentProductHunterResult {
  const candidates: ProductHunterCandidate[] = [];
  const discoveries: ResidentProductHunterDiscovery[] = [];
  hunt.pipeline.items.forEach((item) => {
    const candidate = item.evaluation.candidate;
    if (!candidate.url) return;
    if (item.evaluation.dropReason === "news_article") return;
    const postable =
      isUsableProductImage(candidate.imageUrl) &&
      item.evaluation.decision !== "DISQUALIFY";
    candidates.push({
      brand: candidate.brand || candidate.marketplace,
      productName: candidate.title,
      category: "other",
      subcategory: candidate.category ?? "",
      country: candidate.marketplace === "ebay" ? null : "JP",
      description: item.evaluation.discoveryReason,
      productUrl: candidate.url,
      officialUrl: null,
      productImageUrl: candidate.imageUrl,
      currency: candidate.currency || "JPY",
      price: candidate.price,
      sku: candidate.sku,
      gtin: candidate.gtin,
      modelNumber: candidate.asin || candidate.epid,
      launchDate: null,
      attentionReason: item.evaluation.whyNow,
      trendTags: [],
      trendScore: item.evaluation.scores.demandConfidence,
      confidenceScore: item.evaluation.confidence,
      origin: "web",
      report: emptyDiscoveryReport({
        brand: candidate.brand || candidate.marketplace,
        productName: candidate.title,
        productUrl: candidate.url,
        productImageUrl: candidate.imageUrl,
        price: candidate.price,
        currency: candidate.currency || "JPY",
        whyNow: item.evaluation.whyNow,
        evidence: item.evaluation.factHypothesis.facts.map((fact) => fact.text),
        sourceUrls: [candidate.url],
        confidenceScore: item.evaluation.confidence,
      }),
    });
    if (postable && hunt.savedProductIds[discoveries.length]) {
      discoveries.push({
        candidateIndex: candidates.length - 1,
        discoveryProductId: hunt.savedProductIds[discoveries.length],
      });
    }
  });
  return {
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery: hunt.pipeline.queries.join(" | "),
    searchResults: hunt.worldResults,
    worldNews: [],
    candidates,
    savedProductIds: hunt.savedProductIds,
    discoveries,
    funnelSummary: hunt.pipeline.items.length
      ? `marketplace items=${hunt.pipeline.items.length} saved=${hunt.savedProductIds.length}`
      : undefined,
    intent: undefined,
    decisions: hunt.pipeline.items.map((item) => ({
      product: item.evaluation.candidate.title,
      decision: item.evaluation.decision,
      reason: item.evaluation.discoveryReason,
    })),
  };
}

function mergeSearchResults(groups: WorldSearchResult[][]) {
  const unique = new Map<string, WorldSearchResult>();
  for (const group of groups) {
    for (const result of group) {
      const key = result.url.replace(/\/$/, "").toLowerCase();
      if (!key || unique.has(key)) continue;
      unique.set(key, result);
    }
  }
  return [...unique.values()];
}

function candidateToDiscoveryInput(
  candidate: ProductHunterCandidate,
  residentId: string,
  rediscovery = false,
): DiscoveryProductInput {
  const now = new Date().toISOString();
  const productImageUrl = isUsableProductImage(candidate.productImageUrl)
    ? candidate.productImageUrl
    : null;
  const tags = rediscovery
    ? Array.from(new Set([...candidate.trendTags, "re_discovered" as const]))
    : candidate.trendTags;

  return {
    id: crypto.randomUUID(),
    brand: candidate.brand,
    productName: candidate.productName,
    category: candidate.category,
    subcategory: candidate.subcategory,
    country: candidate.country,
    description: candidate.description,
    productImageUrl,
    productUrl: candidate.productUrl,
    officialUrl: candidate.officialUrl,
    price: candidate.price,
    currency: candidate.currency,
    sku: candidate.sku,
    gtin: candidate.gtin,
    modelNumber: candidate.modelNumber,
    launchDate: candidate.launchDate,
    canonicalUrl: candidate.report.canonicalUrl,
    discoveryReport: {
      ...candidate.report,
      trendTags: tags,
    },
    trendScore: candidate.trendScore,
    confidenceScore: candidate.confidenceScore,
    discoverySource: "ai",
    discoveredByResidentId: residentId,
    discoveredAt: now,
    attentionReason: candidate.attentionReason,
    status: "pending",
    trendTags: tags,
    sources: [
      {
        id: crypto.randomUUID(),
        sourceType: candidate.officialUrl ? "brand_official" : "other",
        sourceUrl: candidate.productUrl,
        sourceTitle: `${candidate.brand} - ${candidate.productName}`,
        sourceDomain: new URL(candidate.productUrl).hostname,
        publishedAt: candidate.launchDate,
        sourceExcerpt: candidate.description,
        verificationStatus: "unverified",
        sourceTier: candidate.officialUrl ? 1 : 4,
        createdAt: now,
      },
    ],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function processAssignedTracerDiscoveries(
  persona: AiPersona,
  options?: { selfState?: SelfState | null; experiences?: Experience[] },
): Promise<Array<{ product: string; decision: string; reason: string }>> {
  const assigned = await listAssignedDiscoveries(persona.id);
  const tracerProducts = assigned.filter((product) => product.discovery_source === "tracer");
  if (tracerProducts.length === 0) return [];

  const openInvestigations = await loadOpenInvestigations(persona.id);
  const huntingSpecialty =
    getSpecialistHunterByUsername(persona.username)?.huntingSpecialty ||
    (persona.expertise ?? []).slice(0, 3).join(" / ") ||
    undefined;
  const state = options?.selfState ?? buildSelfState({
    name: persona.persona_name,
    username: persona.username,
    role: persona.resident_role,
    values: persona.values,
    interests: persona.interests,
    expertise: persona.expertise,
    huntingSpecialty,
    countryCode: persona.country_code,
    region: persona.region,
    languages: persona.languages,
  });
  const decisions: Array<{ product: string; decision: string; reason: string }> = [...assignedTracerDecisions];

  for (const product of tracerProducts) {
    const brand = String(product.brand ?? "Unknown");
    const productName = String(product.product_name ?? "");
    const identity = productIdentityKey({
      brand,
      productName,
      productUrl: product.product_url,
      officialUrl: product.official_url,
    });
    const existing = openInvestigations.find(
      (item) => item.productId === String(product.id) || item.entityKey === identity,
    );
    if (!existing) continue;

    const decision = decideTowardProduct({
      persona: {
        name: persona.persona_name,
        username: persona.username,
        role: persona.resident_role,
        values: persona.values,
        interests: persona.interests,
        expertise: persona.expertise,
        huntingSpecialty,
        countryCode: persona.country_code,
        region: persona.region,
        languages: persona.languages,
      },
      state,
      product: {
        brand,
        productName,
        url: product.product_url,
        category: String(product.category ?? "other"),
        description: String(product.description ?? ""),
        evidenceScore: Number(product.confidence_score ?? 0),
        origin: "tracer",
        officialUrl: product.official_url,
      },
      experiences: options?.experiences,
    });
    decisions.push({
      product: `${brand} ${productName}`.trim(),
      decision: decision.decision,
      reason: decision.reasonSummary,
    });

    await upsertInvestigation({
      personaId: persona.id,
      profileId: persona.profile_id ?? null,
      actorName: persona.persona_name,
      actorRole: persona.resident_role || "product_hunter",
      title: productName,
      summary:
        String(product.attention_reason ?? "") ||
        String(product.description ?? "") ||
        `TRACER candidate for ${brand} ${productName}`,
      beat: String(product.category ?? "other"),
      sourceUrl: product.official_url || product.product_url,
      sourceTitle: productName,
      sourceKind: "tracer_product_candidate",
      entityKey: identity,
      productId: String(product.id),
      evidenceCount: 1,
      confidence: Number(product.confidence_score ?? 0),
      decision: decision.decision,
      qualityOk: true,
    });
  }

  return decisions;
}

export async function runResidentProductHunter(
  persona: AiPersona,
  sharedWorldNews: WorldSearchResult[] = [],
  options?: {
    dryRun?: boolean;
    intent?: Intent | null;
    selfState?: SelfState | null;
    experiences?: Experience[];
    exploration?: ExplorationQuest | null;
  },
): Promise<ResidentProductHunterResult> {
  if (isMarketplaceCorrespondentUsername(persona.username)) {
    const hunt = await runNewfindMarketplaceHunt(persona, {
      dryRun: options?.dryRun,
    });
    if (hunt) {
      return marketplaceHuntAsHunterResult(persona, hunt);
    }
  }
  const specialist = getSpecialistHunterByUsername(persona.username);
  const strategy = getHunterStrategy(persona.username);
  const huntingSpecialty =
    specialist?.huntingSpecialty ||
    (persona.expertise ?? []).slice(0, 3).join(" / ") ||
    undefined;

  let existingProducts: Awaited<ReturnType<typeof listDiscoveryProductsFromDb>> = [];
  try {
    existingProducts = await listDiscoveryProductsFromDb({
      admin: true,
      status: "all",
    });
  } catch (error) {
    console.warn("AI PRODUCT HUNTER: existing products unavailable", error);
  }
  const recentMine = existingProducts
    .filter((item) => item.discoveredByResidentId === persona.id)
    .slice(0, 8);
  const recentNames = recentMine.map((item) => item.productName);
  const recentUrls = existingProducts
    .filter((item) => item.discoveredByResidentId === persona.id)
    .flatMap((item) => [item.productUrl, item.officialUrl])
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
  const recentUrlSet = new Set(
    recentUrls.map((item) => item.replace(/\/$/, "").toLowerCase()),
  );

  let signals = null;
  try {
    if (persona.profile_id) {
      signals = await loadResidentHumanSignals({
        profileId: persona.profile_id,
        discoveryProductIds: existingProducts
          .filter((item) => item.discoveredByResidentId === persona.id)
          .map((item) => item.id)
          .slice(0, 40),
      });
    }
  } catch (error) {
    console.warn("AI PRODUCT HUNTER: human signals unavailable", error);
  }

  const nextHunt = planNextHunt({
    persona,
    signals,
    recentProductNames: recentNames,
    ignoredNames: recentUrls,
    worldHints: sharedWorldNews.slice(0, 3).map((item) => item.title),
  });
  const huntQueries = buildPrecisionHuntQueries({
    residentName: persona.persona_name,
    interests: persona.interests ?? [],
    preferredCategories: persona.preferred_categories ?? [],
    goals: persona.goals ?? [],
    expertise: persona.expertise ?? [],
    values: persona.values ?? [],
    country: persona.country_code || persona.region || null,
    language: persona.languages?.[0],
    favoriteBrands: persona.favorite_brands ?? [],
    region: persona.region,
    discoveryKeywords: specialist?.discoveryKeywords ?? persona.interests ?? [],
    huntingSpecialty,
    username: persona.username,
    nextHunt,
    strategy,
    intentTerms: options?.intent?.terms,
    exploration: options?.exploration,
  });

  console.log(
    `[AI PRODUCT HUNTER] ${persona.persona_name} queries:`,
    huntQueries.map((item) => `${item.label}=${item.query}`).join(" || "),
  );

  const emptyHunter = (
    extras?: Partial<ResidentProductHunterResult>,
  ): ResidentProductHunterResult => ({
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery: huntQueries.map((item) => item.query).join(" || "),
    searchResults: [],
    worldNews: sharedWorldNews.filter(isNewsSignal),
    candidates: [],
    savedProductIds: [],
    discoveries: [],
    funnelSummary: extras?.funnelSummary,
    intent: options?.intent ?? undefined,
    decisions: extras?.decisions ?? [],
    searchPasses: extras?.searchPasses,
    newResultCount: extras?.newResultCount,
    explorationAxis: options?.exploration?.axis,
  });

  if (options?.intent && !shouldSearchNow(options.intent)) {
    return emptyHunter({
      funnelSummary: `WAIT stance=${options.intent.stance}`,
      decisions: [
        {
          product: "none",
          decision: options.intent.stance === "observe" ? "OBSERVE" : "WAIT",
          reason: options.intent.why,
        },
      ],
    });
  }

  const trace = createPipelineTrace({
    actorName: persona.display_name || persona.persona_name,
    actorRole: "product_hunter",
    personaId: persona.id,
    query: huntQueries.map((item) => item.query).join(" || "),
  });
  markPipelineEvent(trace, "SEARCH_STARTED");

  const assignedTracerDecisions = await processAssignedTracerDiscoveries(persona, options);

  let searched: WorldSearchResult[][];
  try {
    searched = await Promise.all(
      huntQueries.map((query) =>
        searchWorld({
          ...query,
          residentId: persona.id,
          residentName: persona.persona_name,
        }),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDrop(trace, { reason: "SEARCH_FAILED", detail: message });
    if (!options?.dryRun) {
      await logAiActivity({
        personaId: persona.id,
        actorName: trace.actorName,
        actorRole: "product_hunter",
        action: "error",
        detail: funnelSummary(trace.funnel),
        metadata: { funnel: trace.funnel, events: trace.events, drops: trace.drops },
      });
    }
    return emptyHunter({
      funnelSummary: funnelSummary(trace.funnel),
      decisions: [{ product: "none", decision: "WAIT", reason: message }],
    });
  }

  let productResults = mergeSearchResults(searched);
  let searchPasses = huntQueries.length;
  const extraQueries = (options?.exploration?.queries ?? []).slice(huntQueries.length, 3);
  if (productResults.filter(isProductSource).length < 3 && extraQueries.length) {
    for (const extra of extraQueries) {
      try {
        const more = await searchWorld({
          residentId: persona.id,
          residentName: persona.persona_name,
          interests: persona.interests ?? [],
          preferredCategories: persona.preferred_categories ?? [],
          goals: persona.goals ?? [],
          query: extra,
          country: persona.country_code,
          language: persona.languages?.[0],
          region: options?.exploration?.city || persona.region,
          huntingSpecialty,
          excludeDomains: options?.exploration?.excludeDomains,
        });
        productResults = mergeSearchResults([productResults, more]);
        searchPasses += 1;
        if (productResults.filter(isProductSource).length >= 3) break;
      } catch (error) {
        console.warn("hunter continuation search failed", extra, error);
      }
    }
  }
  const roles = classifySearchRoles(productResults);
  trace.funnel.searchResults = productResults.length;
  trace.funnel.productCandidates = roles.productCandidates;
  trace.funnel.newsCandidates = roles.newsCandidates;
  trace.funnel.generalCandidates = roles.generalCandidates;
  markPipelineEvent(trace, "SEARCH_COMPLETED");
  markPipelineEvent(trace, "CLASSIFICATION_COMPLETED");

  if (productResults.length === 0) {
    recordDrop(trace, { reason: "NO_SEARCH_RESULTS" });
  }

  const newsSignals = sharedWorldNews.filter(isNewsSignal);
  const productSources = productResults.filter((result) => {
    if (!isProductSource(result)) return false;
    const key = result.url.replace(/\/$/, "").toLowerCase();
    if (recentUrlSet.has(key)) {
      recordDrop(trace, { url: result.url, reason: "RECENTLY_SEEN" });
      return false;
    }
    const fits = resultFitsHunterSpecialty({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      username: persona.username,
      huntingSpecialty,
      strategy,
    });
    if (!fits) {
      recordDrop(trace, { url: result.url, reason: "SPECIALTY_MISMATCH" });
      return false;
    }
    return true;
  });
  trace.funnel.specialtyPass = productSources.length;
  const searchResults = [...newsSignals, ...productSources];
  const searchQuery = huntQueries.map((item) => item.query).join(" || ");

  if (productSources.length === 0) {
    if (roles.productCandidates === 0 && productResults.length > 0) {
      recordDrop(trace, { reason: "NOT_PRODUCT" });
    }
    if (!options?.dryRun) {
      await logAiActivity({
        personaId: persona.id,
        actorName: trace.actorName,
        actorRole: "product_hunter",
        action: "no_action",
        detail: funnelSummary(trace.funnel),
        metadata: { funnel: trace.funnel, events: trace.events, query: searchQuery },
      });
    }
    return {
      residentId: persona.id,
      residentName: persona.persona_name,
      searchQuery,
      searchResults,
      worldNews: newsSignals,
      candidates: [],
      savedProductIds: [],
      discoveries: [],
    funnelSummary: funnelSummary(trace.funnel),
    intent: options?.intent ?? undefined,
    decisions: assignedTracerDecisions,
    searchPasses,
    newResultCount: productSources.length,
    explorationAxis: options?.exploration?.axis,
  };
}

  const candidates = await evaluateProductCandidates({
    residentId: persona.id,
    residentName: persona.persona_name,
    personality: persona.personality,
    interests: persona.interests ?? [],
    preferredCategories: persona.preferred_categories ?? [],
    goals: persona.goals ?? [],
    expertise: persona.expertise ?? [],
    values: persona.values ?? [],
    region: persona.region,
    languages: persona.languages ?? [],
    culture: persona.culture,
    huntingSpecialty,
    hunterUsername: persona.username ?? undefined,
    results: searchResults,
  });
  const savedProductIds: string[] = [];
  const discoveries: ResidentProductHunterDiscovery[] = [];
  const decisions: Array<{ product: string; decision: string; reason: string }> = [];
  const avoidNames = new Set(
    nextHunt.avoid.map((name) => coreProductName(name)).filter(Boolean),
  );

  for (
    let candidateIndex = 0;
    candidateIndex < candidates.length;
    candidateIndex++
  ) {
    const candidate = candidates[candidateIndex];
    if (candidate.origin === "catalog") {
      console.log(
        `[AI PRODUCT HUNTER] catalog fallback kept as candidate but not saved as this-cycle discovery: ${candidate.brand} / ${candidate.productName}`,
      );
      recordDrop(trace, {
        url: candidate.productUrl,
        reason: "NOT_LIVE_PRODUCT",
        detail: "catalog",
      });
      continue;
    }

    const avoided = coreProductName(candidate.productName);
    if (avoided && avoidNames.has(avoided)) {
      console.log(
        `[AI PRODUCT HUNTER] avoided recent/ignored product: ${candidate.brand} / ${candidate.productName}`,
      );
      recordDrop(trace, {
        url: candidate.productUrl,
        title: candidate.productName,
        reason: "RECENTLY_SEEN",
      });
      continue;
    }

    const match = classifyProductMatch(
      {
        brand: candidate.brand,
        productName: candidate.productName,
        sku: candidate.sku,
        gtin: candidate.gtin,
        modelNumber: candidate.modelNumber,
        productUrl: candidate.productUrl,
        officialUrl: candidate.officialUrl,
        attentionReason: candidate.attentionReason,
        trendTags: candidate.trendTags,
        price: candidate.price,
      },
      existingProducts,
    );

    if (match.kind === "duplicate") {
      console.log(
        `[AI PRODUCT HUNTER] duplicate skipped: ${candidate.brand} / ${candidate.productName} -> ${match.match?.id ?? candidate.productUrl}`,
      );
      candidate.report.duplicateRisk = 95;
      trace.funnel.duplicates += 1;
      recordDrop(trace, {
        url: candidate.productUrl,
        title: candidate.productName,
        reason: "DUPLICATE",
      });
      continue;
    }

    if (match.kind === "rediscovery" && match.match) {
      candidate.report.duplicateRisk = 40;
      candidate.attentionReason = `${candidate.attentionReason} Re-discovery: new signal since last sighting.`;
      discoveries.push({
        candidateIndex,
        discoveryProductId: options?.dryRun ? `dry-${candidateIndex}` : match.match.id,
      });
      continue;
    }

    const mindDecision = decideTowardProduct({
      persona: {
        name: persona.persona_name,
        username: persona.username,
        role: persona.resident_role,
        values: persona.values,
        interests: persona.interests,
        expertise: persona.expertise,
        huntingSpecialty,
        countryCode: persona.country_code,
        region: persona.region,
        languages: persona.languages,
      },
      state: options?.selfState ?? buildSelfState({
        name: persona.persona_name,
        username: persona.username,
        role: persona.resident_role,
        values: persona.values,
        interests: persona.interests,
        expertise: persona.expertise,
        huntingSpecialty,
        countryCode: persona.country_code,
        region: persona.region,
        languages: persona.languages,
      }),
      product: {
        brand: candidate.brand,
        productName: candidate.productName,
        url: candidate.productUrl,
        category: candidate.category,
        description: candidate.description,
        evidenceScore: candidate.report.evidenceScore,
        specialtyFit: candidate.report.residentFitScore,
        origin: candidate.origin,
        officialUrl: candidate.officialUrl,
      },
      experiences: options?.experiences,
    });
    decisions.push({
      product: `${candidate.brand} ${candidate.productName}`,
      decision: mindDecision.decision,
      reason: mindDecision.reasonSummary,
    });
    if (!shouldSaveNow(options?.intent ?? { stance: "explore", focus: "", why: "", terms: [], avoid: [] }, mindDecision.decision)) {
      recordDrop(trace, {
        url: candidate.productUrl,
        title: candidate.productName,
        reason: mindDecision.decision === "WAIT" ? "RECENTLY_SEEN" : "AI_REJECTED",
        detail: mindDecision.reasonSummary,
      });
      continue;
    }

    if (options?.dryRun) {
      discoveries.push({
        candidateIndex,
        discoveryProductId: `dry-${candidateIndex}`,
      });
      continue;
    }

    const input = candidateToDiscoveryInput(candidate, persona.id, false);
    const prepared = prepareDiscoveryProduct(input);
    const saved = await saveDiscoveryProductToDb(prepared);

    savedProductIds.push(saved.id);
    discoveries.push({
      candidateIndex,
      discoveryProductId: saved.id,
    });
    existingProducts = [...existingProducts, saved];
    trace.funnel.saved += 1;
    recordDrop(trace, {
      url: candidate.productUrl,
      title: candidate.productName,
      reason: "SAVED",
    });
  }

  markPipelineEvent(trace, "SAVE_COMPLETED");
  console.log(
    `[AI PRODUCT HUNTER] ${persona.persona_name} funnel:`,
    funnelSummary(trace.funnel),
  );
  if (!options?.dryRun) {
    await logAiActivity({
      personaId: persona.id,
      actorName: trace.actorName,
      actorRole: "product_hunter",
      action: savedProductIds.length ? "candidate_found" : "no_action",
      detail: funnelSummary(trace.funnel),
      relatedProductId: savedProductIds[0] ?? null,
      metadata: {
        funnel: trace.funnel,
        events: trace.events,
        query: searchQuery,
        drops: trace.drops.slice(0, 20),
      },
    });
  }

  return {
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery,
    searchResults,
    worldNews: newsSignals,
    candidates,
    savedProductIds,
    discoveries,
    funnelSummary: funnelSummary(trace.funnel),
    intent: options?.intent ?? undefined,
    decisions,
    searchPasses,
    newResultCount: productSources.length,
    explorationAxis: options?.exploration?.axis,
  };
}

