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
import { saveDiscoveryProductToDb } from "@/lib/discovery/db";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryProductInput } from "@/lib/discovery/types";

export type ResidentProductHunterResult = {
  residentId: string;
  residentName: string;
  searchQuery: string;
  searchResults: WorldSearchResult[];
  worldNews: WorldSearchResult[];
  candidates: ProductHunterCandidate[];
  savedProductIds: string[];
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
): Promise<ResidentProductHunterResult> {
  const query = buildResidentSearchQuery({
    residentName: persona.persona_name,
    interests: persona.interests ?? [],
    preferredCategories: persona.preferred_categories ?? [],
    goals: persona.goals ?? [],
    expertise: persona.expertise ?? [],
    values: persona.values ?? [],
    country: persona.country_code || persona.region || null,
    language: persona.languages?.[0],
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
    results: searchResults,
  });

  const savedProductIds: string[] = [];

  for (const candidate of candidates) {
    const input = candidateToDiscoveryInput(candidate, persona.id);
    const saved = await saveDiscoveryProductToDb(input);
    savedProductIds.push(saved.id);
  }

  return {
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery: query.query,
    searchResults,
    worldNews: newsSignals,
    candidates,
    savedProductIds,
  };
}
