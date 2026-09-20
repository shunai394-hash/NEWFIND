import type { AdapterRegistry } from "./adapters";
import { searchMarketplace } from "./adapters";
import {
  evaluateMarketplaceCandidate,
  growthFromLearning,
  nextQueries,
  shouldStartSupplierResearch,
} from "./evaluate";
import type { MarketplaceCorrespondentSpec } from "./types";
import type {
  CorrespondentGrowth,
  CorrespondentLearningRecord,
  DropReason,
  MarketplaceProductCandidate,
  MarketplaceSearchResult,
  ProductEvaluation,
} from "./types";
import { marketplaceIdentityKey } from "./identity";
import { qualifyForPricesense, type PricesenseQualification } from "./pricesense";
import {
  researchSuppliers,
  type SupplierResearchDeps,
  type SupplierResearchResult,
} from "./supplier";

export type PipelineDrop = {
  reason: DropReason | "adapter_disabled";
  title: string;
  url: string;
};

export type MarketplacePipelineItem = {
  evaluation: ProductEvaluation;
  suppliers: SupplierResearchResult | null;
  pricesense: PricesenseQualification;
};

export type MarketplacePipelineResult = {
  correspondentId: MarketplaceCorrespondentSpec["id"];
  marketplace: MarketplaceCorrespondentSpec["marketplace"];
  adapterEnabled: boolean;
  adapterReason: string | null;
  queries: string[];
  searchResults: MarketplaceSearchResult[];
  items: MarketplacePipelineItem[];
  drops: PipelineDrop[];
  learning: CorrespondentLearningRecord[];
  humanReview: "pending_human";
};

export type MarketplacePipelineInput = {
  correspondent: MarketplaceCorrespondentSpec;
  adapters: AdapterRegistry;
  growth?: CorrespondentGrowth;
  previousLearning?: CorrespondentLearningRecord[];
  existingKeys?: Set<string>;
  japanListedKeys?: Set<string>;
  supplier?: Omit<SupplierResearchDeps, "cached"> & {
    loadCached?: (identityKey: string) => Promise<SupplierResearchResult | null>;
  };
  now?: () => Date;
};

export async function runMarketplacePipeline(
  input: MarketplacePipelineInput,
): Promise<MarketplacePipelineResult> {
  const now = input.now?.() ?? new Date();
  const growth =
    input.growth ?? growthFromLearning(input.previousLearning ?? []);
  const adapter = input.adapters[input.correspondent.marketplace];
  const status = adapter.status();
  const queries = nextQueries(input.correspondent.defaultQueries, growth);
  const searchResults: MarketplaceSearchResult[] = [];
  const drops: PipelineDrop[] = [];
  const items: MarketplacePipelineItem[] = [];
  const learning: CorrespondentLearningRecord[] = [];
  const seen = new Set<string>();

  if (!status.enabled) {
    learning.push({
      correspondentId: input.correspondent.id,
      query: queries[0] ?? "",
      marketplace: input.correspondent.marketplace,
      identityKey: null,
      candidateTitle: null,
      decision: null,
      confidence: null,
      humanFeedback: null,
      actualResult: null,
      rejectionReason: "adapter_disabled",
      supplierResult: null,
      eventualSalesSignal: null,
      createdAt: now.toISOString(),
    });
    return {
      correspondentId: input.correspondent.id,
      marketplace: input.correspondent.marketplace,
      adapterEnabled: false,
      adapterReason: status.reason,
      queries,
      searchResults: [],
      items: [],
      drops: [
        {
          reason: "adapter_disabled",
          title: status.reason || "adapter disabled",
          url: "",
        },
      ],
      learning,
      humanReview: "pending_human",
    };
  }

  for (const query of queries) {
    const result = await searchMarketplace(input.adapters, {
      query,
      marketplace: input.correspondent.marketplace,
      correspondentId: input.correspondent.id,
    });
    searchResults.push(result);
    if (result.unavailableReason && result.candidates.length === 0) {
      drops.push({
        reason: "adapter_disabled",
        title: result.unavailableReason,
        url: "",
      });
    }
    for (const candidate of result.candidates) {
      const key = marketplaceIdentityKey(candidate);
      if (seen.has(key)) {
        drops.push({
          reason: "duplicate_product",
          title: candidate.title,
          url: candidate.url,
        });
        continue;
      }
      seen.add(key);
      const evaluation = evaluateMarketplaceCandidate(candidate, {
        growth,
        existingKeys: input.existingKeys,
        japanListed: input.japanListedKeys
          ? input.japanListedKeys.has(key)
          : undefined,
      });
      if (evaluation.dropReason && evaluation.decision === "DISQUALIFY") {
        drops.push({
          reason: evaluation.dropReason,
          title: candidate.title,
          url: candidate.url,
        });
      }

      let suppliers: SupplierResearchResult | null = null;
      if (shouldStartSupplierResearch(evaluation) && input.supplier) {
        const cached = input.supplier.loadCached
          ? await input.supplier.loadCached(evaluation.identityKey)
          : null;
        suppliers = await researchSuppliers(candidate, evaluation.identityKey, {
          search: input.supplier.search,
          fetchPage: input.supplier.fetchPage,
          now: input.now,
          cached: cached ?? null,
        });
      }

      const pricesense = qualifyForPricesense({ evaluation, suppliers });
      items.push({ evaluation, suppliers, pricesense });
      learning.push({
        correspondentId: input.correspondent.id,
        query,
        marketplace: candidate.marketplace,
        identityKey: evaluation.identityKey,
        candidateTitle: candidate.title,
        decision: evaluation.decision,
        confidence: evaluation.confidence,
        humanFeedback: null,
        actualResult: null,
        rejectionReason: evaluation.dropReason,
        supplierResult: suppliers
          ? `${suppliers.suppliers.length} suppliers`
          : "not_started",
        eventualSalesSignal: null,
        createdAt: now.toISOString(),
      });
    }
  }

  return {
    correspondentId: input.correspondent.id,
    marketplace: input.correspondent.marketplace,
    adapterEnabled: true,
    adapterReason: null,
    queries,
    searchResults,
    items,
    drops,
    learning,
    humanReview: "pending_human",
  };
}

export function candidatesFromPipeline(
  result: MarketplacePipelineResult,
): MarketplaceProductCandidate[] {
  return result.items.map((item) => item.evaluation.candidate);
}
