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
import { prepareDiscoveryProduct } from "@/lib/discovery/rules";
import { classifyProductMatch } from "@/lib/ai/product-identity";
import { getSpecialistHunterByUsername } from "@/lib/ai/specialist-product-hunters";
import { getHunterStrategy, rotateVocabulary } from "@/lib/ai/hunter-strategies";
import { planNextHunt } from "@/lib/ai/explore-next";

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

export async function runResidentProductHunter(
  persona: AiPersona,
  sharedWorldNews: WorldSearchResult[] = [],
  options?: { dryRun?: boolean },
): Promise<ResidentProductHunterResult> {
  const specialist = getSpecialistHunterByUsername(persona.username);
  const strategy = getHunterStrategy(persona.username);
  const huntingSpecialty =
    specialist?.huntingSpecialty ||
    (persona.expertise ?? []).slice(0, 3).join(" / ") ||
    undefined;
  const nextHunt = planNextHunt({
    persona,
    worldHints: sharedWorldNews.slice(0, 3).map((item) => item.title),
  });
  const rotated = rotateVocabulary(
    strategy,
    `${persona.id}:${new Date().toISOString().slice(0, 10)}`,
    3,
  );
  const baseQuery = buildResidentSearchQuery({
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
    discoveryKeywords: [
      ...(specialist?.discoveryKeywords ?? persona.interests ?? []),
      ...nextHunt.vocabulary,
    ],
    huntingSpecialty,
  });
  const exploratoryQuery = {
    ...baseQuery,
    query: [baseQuery.query, ...rotated, strategy?.newnessPreference === "launch" ? "new release" : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  };

  const [primaryResults, extraResults] = await Promise.all([
    searchWorld({
      ...baseQuery,
      residentId: persona.id,
      residentName: persona.persona_name,
    }),
    searchWorld({
      ...exploratoryQuery,
      residentId: persona.id,
      residentName: persona.persona_name,
    }),
  ]);

  const productResults = mergeSearchResults([primaryResults, extraResults]);
  const newsSignals = sharedWorldNews.filter(isNewsSignal);
  const productSources = productResults.filter(isProductSource);
  const searchResults = [...newsSignals, ...productSources];

  if (productSources.length === 0) {
    return {
      residentId: persona.id,
      residentName: persona.persona_name,
      searchQuery: `${baseQuery.query} || ${exploratoryQuery.query}`,
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
  }

  return {
    residentId: persona.id,
    residentName: persona.persona_name,
    searchQuery: `${baseQuery.query} || ${exploratoryQuery.query}`,
    searchResults,
    worldNews: newsSignals,
    candidates,
    savedProductIds,
    discoveries,
  };
}
