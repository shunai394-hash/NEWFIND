import type { AiPersona } from "@/lib/ai-post-engine";
import type { WorldSearchResult } from "@/lib/ai/world-search";
import { searchWorld } from "@/lib/ai/world-search";
import { fetchPageHtml } from "@/lib/ai/product-page";
import { isUsableProductImage } from "@/lib/discovery/media";
import {
  listDiscoveryProductsFromDb,
  saveDiscoveryProductToDb,
} from "@/lib/discovery/db";
import { prepareDiscoveryProduct } from "@/lib/discovery/rules";
import { classifyProductMatch } from "@/lib/ai/product-identity";
import type { DiscoveryProduct, DiscoveryProductInput } from "@/lib/discovery/types";
import { emptyDiscoveryReport } from "@/lib/ai/discovery-report";
import { createMarketplaceAdapters } from "./adapters";
import { marketplaceCorrespondentByUsername } from "./correspondents";
import { runMarketplacePipeline, type MarketplacePipelineResult } from "./pipeline";
import {
  loadCachedSupplierResearch,
  loadCorrespondentLearning,
  loadExistingMarketplaceKeys,
  persistMarketplacePipeline,
} from "./store";
import { newsLooksLikeProduct } from "./guard";
import type { MarketplacePipelineItem } from "./pipeline";

export type NewfindMarketplaceHuntResult = {
  pipeline: MarketplacePipelineResult;
  savedProductIds: string[];
  worldResults: WorldSearchResult[];
  skippedPosts: Array<{ title: string; reason: string }>;
};

export function itemToWorldResult(item: MarketplacePipelineItem): WorldSearchResult | null {
  const candidate = item.evaluation.candidate;
  if (newsLooksLikeProduct(candidate.title, candidate.url)) return null;
  if (!candidate.url) return null;
  return {
    title: candidate.title,
    url: candidate.url,
    snippet: [
      candidate.brand,
      candidate.price != null
        ? `${candidate.price} ${candidate.currency ?? ""}`.trim()
        : "price unknown",
      candidate.transactionSignal,
    ]
      .filter(Boolean)
      .join(" · "),
    sourceType: "retailer",
    domain: new URL(candidate.url).hostname.replace(/^www\./i, ""),
    imageUrl: candidate.imageUrl,
    sourceRole: "product",
    origin: "web",
    sourceReliability: "trusted_retailer",
    retrievedAt: candidate.observedAt,
    classificationReason: `marketplace:${candidate.marketplace}`,
  };
}

function canBecomeDiscovery(item: MarketplacePipelineItem) {
  const candidate = item.evaluation.candidate;
  if (item.evaluation.dropReason === "news_article") return false;
  if (newsLooksLikeProduct(candidate.title, candidate.url)) return false;
  if (!candidate.url) return false;
  if (!isUsableProductImage(candidate.imageUrl)) return false;
  if (item.evaluation.decision === "DISQUALIFY") return false;
  return true;
}

export function itemToDiscoveryInput(
  item: MarketplacePipelineItem,
  residentId: string,
): DiscoveryProductInput | null {
  if (!canBecomeDiscovery(item)) return null;
  const candidate = item.evaluation.candidate;
  const now = candidate.observedAt;
  const brand = candidate.brand || candidate.marketplace;
  return {
    id: crypto.randomUUID(),
    brand,
    productName: candidate.title,
    category: "other",
    subcategory: candidate.category ?? "",
    country: candidate.marketplace === "ebay" ? null : "JP",
    description: item.evaluation.discoveryReason,
    productImageUrl: candidate.imageUrl,
    productUrl: candidate.url,
    officialUrl: null,
    price: candidate.price,
    currency: candidate.currency || "JPY",
    sku: candidate.sku,
    gtin: candidate.gtin,
    modelNumber: candidate.asin || candidate.epid,
    canonicalUrl: candidate.url,
    discoveryReport: emptyDiscoveryReport({
      brand,
      productName: candidate.title,
      productUrl: candidate.url,
      productImageUrl: candidate.imageUrl,
      price: candidate.price,
      currency: candidate.currency || "JPY",
      whyNow: item.evaluation.whyNow,
      evidence: item.evaluation.factHypothesis.facts.map((fact) => fact.text),
      sourceUrls: [candidate.url],
      confidenceScore: item.evaluation.confidence,
      evidenceScore: item.evaluation.scores.sourceConfidence,
    }),
    trendScore: item.evaluation.scores.demandConfidence,
    confidenceScore: item.evaluation.confidence,
    discoverySource: "ai",
    discoveredByResidentId: residentId,
    discoveredAt: now,
    attentionReason: item.evaluation.whyNow,
    status: "pending",
    trendTags: [],
    sources: [
      {
        id: crypto.randomUUID(),
        sourceType: "other",
        sourceUrl: candidate.url,
        sourceTitle: candidate.title,
        sourceDomain: new URL(candidate.url).hostname,
        publishedAt: null,
        sourceExcerpt: item.evaluation.demandReason,
        verificationStatus: "unverified",
        sourceTier: 3,
        createdAt: now,
      },
    ],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function runNewfindMarketplaceHunt(
  persona: AiPersona,
  options?: { dryRun?: boolean },
): Promise<NewfindMarketplaceHuntResult | null> {
  const spec = marketplaceCorrespondentByUsername(persona.username);
  if (!spec) return null;

  const learning = await loadCorrespondentLearning(spec.id);
  const existingKeys = await loadExistingMarketplaceKeys();
  const adapters = createMarketplaceAdapters();
  const pipeline = await runMarketplacePipeline({
    correspondent: spec,
    adapters,
    previousLearning: learning,
    existingKeys,
    supplier: {
      search: async (query: string) => {
        const results = await searchWorld({
          residentId: persona.id,
          residentName: persona.persona_name,
          interests: persona.interests ?? [],
          preferredCategories: persona.preferred_categories ?? [],
          goals: persona.goals ?? [],
          query: `${query} official wholesale distributor -ebay -amazon -mercari`,
          country: spec.countryCode,
          language: spec.countryCode === "JP" ? "ja" : "en",
        });
        return results
          .filter((item) => item.sourceRole !== "news")
          .map((item) => ({
            title: item.title,
            url: item.url,
            snippet: item.snippet,
            sourceName: item.domain,
          }));
      },
      fetchPage: fetchPageHtml,
      loadCached: loadCachedSupplierResearch,
    },
  });

  const skippedPosts: Array<{ title: string; reason: string }> = [];
  const worldResults: WorldSearchResult[] = [];
  const savedProductIds: string[] = [];
  const discoveryIds = new Map<string, string>();

  let existingProducts: DiscoveryProduct[] = [];
  try {
    existingProducts = await listDiscoveryProductsFromDb({ admin: true, status: "all" });
  } catch {
    existingProducts = [];
  }

  for (const item of pipeline.items) {
    const world = itemToWorldResult(item);
    if (world) worldResults.push(world);
    const draft = itemToDiscoveryInput(item, persona.id);
    if (!draft) {
      skippedPosts.push({
        title: item.evaluation.candidate.title,
        reason:
          item.evaluation.dropReason ||
          (!item.evaluation.candidate.imageUrl
            ? "missing_image"
            : "not_postable_discovery"),
      });
      continue;
    }
    const prepared = prepareDiscoveryProduct(draft);
    const match = classifyProductMatch(prepared, existingProducts);
    if (match.kind === "duplicate" && match.match) {
      discoveryIds.set(item.evaluation.identityKey, match.match.id);
      skippedPosts.push({
        title: item.evaluation.candidate.title,
        reason: "existing_product",
      });
      continue;
    }
    if (options?.dryRun) {
      savedProductIds.push(`dry-${item.evaluation.identityKey}`);
      continue;
    }
    try {
      const saved = await saveDiscoveryProductToDb(prepared);
      savedProductIds.push(saved.id);
      discoveryIds.set(item.evaluation.identityKey, saved.id);
      existingProducts.push(saved);
    } catch (error) {
      console.warn("marketplace discovery save failed", error);
    }
  }

  if (!options?.dryRun) {
    await persistMarketplacePipeline(pipeline, { discoveryIds });
  }

  return { pipeline, savedProductIds, worldResults, skippedPosts };
}
