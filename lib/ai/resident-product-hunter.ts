import {
  buildResidentSearchQuery,
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
import { findDuplicate, prepareDiscoveryProduct, canonicalProductUrl } from "@/lib/discovery/rules";
import { getSpecialistHunterByUsername } from "@/lib/ai/specialist-product-hunters";

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
};

function candidateToDiscoveryInput(
  candidate: ProductHunterCandidate,
  residentId: string,
): DiscoveryProductInput {
  const now = new Date().toISOString();
  const productImageUrl = isUsableProductImage(candidate.productImageUrl)
    ? candidate.productImageUrl
    : null;

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
    sku: null,
    trendScore: candidate.trendScore,
    confidenceScore: candidate.confidenceScore,
    discoverySource: "ai",
    discoveredByResidentId: residentId,
    discoveredAt: now,
    attentionReason: candidate.attentionReason,
    status: "pending",
    trendTags: candidate.trendTags,
    sources: [
      {
        id: crypto.randomUUID(),
        sourceType: "other",
        sourceUrl: candidate.productUrl,
        sourceTitle: `${candidate.brand} - ${candidate.productName}`,
        sourceDomain: new URL(candidate.productUrl).hostname,
        publishedAt: null,
        sourceExcerpt: candidate.description,
        verificationStatus: "unverified",
        sourceTier: 4,
        createdAt: now,
      },
    ],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function runResidentProductHunter(
  persona: AiPersona,
  sharedWorldNews: WorldSearchResult[] = [],
  options?: { dryRun?: boolean },
): Promise<ResidentProductHunterResult> {
  const specialist = getSpecialistHunterByUsername(persona.username);
  const huntingSpecialty =
    specialist?.huntingSpecialty ||
    (persona.expertise ?? []).slice(0, 3).join(" / ") ||
    undefined;
  const query = buildResidentSearchQuery({
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
  });

  const productResults = await searchWorld({
    ...query,
    residentId: persona.id,
    residentName: persona.persona_name,
  });

  const newsSignals = sharedWorldNews.filter(isNewsSignal);
  const productSources = productResults.filter(isProductSource);
  const searchResults = [...newsSignals, ...productSources];

  if (productSources.length === 0) {
    return {
      residentId: persona.id,
      residentName: persona.persona_name,
      searchQuery: query.query,
      searchResults,
      worldNews: newsSignals,
      candidates: [],
      savedProductIds: [],
      discoveries: [],
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
    results: searchResults,
  });
  const savedProductIds: string[] = [];
  const discoveries: ResidentProductHunterDiscovery[] = [];

  // Load existing discovery products so this run can skip duplicates.
  let existingProducts = await listDiscoveryProductsFromDb({
    admin: true,
    status: "all",
  });

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
      continue;
    }

    if (options?.dryRun) {
      discoveries.push({
        candidateIndex,
        discoveryProductId: `dry-${candidateIndex}`,
      });
      continue;
    }

    const input = candidateToDiscoveryInput(candidate, persona.id);
    const prepared = prepareDiscoveryProduct(input);

    const duplicate = findDuplicate(prepared, existingProducts);
    const duplicateUrl = existingProducts.some(
      (item) =>
        canonicalProductUrl(item.productUrl) ===
        canonicalProductUrl(candidate.productUrl),
    );

    if (duplicate || duplicateUrl) {
      console.log(
        `[AI PRODUCT HUNTER] duplicate skipped: ${candidate.brand} / ${candidate.productName} -> ${duplicate?.id ?? candidate.productUrl}`,
      );
      continue;
    }

    const saved = await saveDiscoveryProductToDb(prepared);

    savedProductIds.push(saved.id);

    discoveries.push({
      candidateIndex,
      discoveryProductId: saved.id,
    });

    // Keep existingProducts in sync so later candidates in this run can detect duplicates.
    existingProducts = [...existingProducts, saved];
  }

  return {
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery: query.query,
    searchResults,
    worldNews: newsSignals,
    candidates,
    savedProductIds,
    discoveries,
  };
}
