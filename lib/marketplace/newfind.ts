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
  /** Newly saved product IDs keyed by the exact pipeline identity, never by array position. */
  savedProductIdsByIdentity: Record<string, string>;
  worldResults: WorldSearchResult[];
  skippedPosts: Array<{ title: string; reason: string }>;
};

/** Resolve only the ID saved for this exact candidate identity. */
export function savedMarketplaceDiscoveryId(
  idsByIdentity: Readonly<Record<string, string>>,
  identityKey: string,
): string | undefined {
  const id = idsByIdentity[identityKey];
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function isPublicHttpsProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password) return false;
    // Marketplace product pages should resolve through public hostnames, not IP literals.
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":")) return false;
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Only qualified, non-rejected candidates with usable product media can be public posts. */
export function isMarketplaceDiscoveryApproved(item: MarketplacePipelineItem): boolean {
  const evaluation = item.evaluation;
  return (
    (evaluation.decision === "STRONG_CANDIDATE" || evaluation.decision === "CANDIDATE") &&
    evaluation.confidence >= 55 &&
    evaluation.scores.sourceConfidence >= 40 &&
    evaluation.dropReason === null &&
    isUsableProductImage(evaluation.candidate.imageUrl) &&
    isPublicHttpsProductUrl(evaluation.candidate.url)
  );
}

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
    status: isMarketplaceDiscoveryApproved(item) ? "approved" : "pending",
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
  const savedProductIdsByIdentity: Record<string, string> = {};
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
      const dryRunId = `dry-${item.evaluation.identityKey}`;
      savedProductIds.push(dryRunId);
      savedProductIdsByIdentity[item.evaluation.identityKey] = dryRunId;
      continue;
    }
    try {
      const saved = await saveDiscoveryProductToDb(prepared);
      savedProductIds.push(saved.id);
      savedProductIdsByIdentity[item.evaluation.identityKey] = saved.id;
      discoveryIds.set(item.evaluation.identityKey, saved.id);
      existingProducts.push(saved);
    } catch (error) {
      console.warn("marketplace discovery save failed", error);
    }
  }

  if (!options?.dryRun) {
    await persistMarketplacePipeline(pipeline, { discoveryIds });
  }

  return { pipeline, savedProductIds, savedProductIdsByIdentity, worldResults, skippedPosts };
}
