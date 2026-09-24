import { createMarketplaceAdapters } from "../lib/marketplace/adapters";
import type { MarketplaceAdapter } from "../lib/marketplace/adapters";
import type { MarketplaceSearchResult } from "../lib/marketplace/types";
import type { MarketplaceProductCandidate } from "../lib/marketplace/types";
import { marketplaceCorrespondentById } from "../lib/marketplace/correspondents";
import { evaluateMarketplaceCandidate, growthFromLearning } from "../lib/marketplace/evaluate";
import { gateMarketplaceCandidate, newsLooksLikeProduct } from "../lib/marketplace/guard";
import { marketplaceIdentityKey } from "../lib/marketplace/identity";
import { runMarketplacePipeline } from "../lib/marketplace/pipeline";
import {
  isMarketplaceSellerUrl,
  researchSuppliers,
  estimateMargin,
} from "../lib/marketplace/supplier";
import { itemToDiscoveryInput } from "../lib/marketplace/newfind";
import {
  qualifyForPricesense,
  rejectSalesEntityAsProduct,
} from "../lib/marketplace/pricesense";
import { MARKETPLACE_RESIDENTS } from "../lib/ai/marketplace-residents";
import { classifyWorldInfo } from "../lib/ai/correspondent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(
  partial: Partial<MarketplaceProductCandidate> &
    Pick<MarketplaceProductCandidate, "marketplace" | "externalProductId" | "title" | "url">,
): MarketplaceProductCandidate {
  const observedAt = partial.observedAt ?? "2026-09-18T00:00:00.000Z";
  return {
    brand: "Acme",
    category: "tech",
    imageUrl: "https://cdn.example.test/p.jpg",
    price: 42,
    currency: "USD",
    sellerName: "seller1",
    sellerType: "marketplace_seller",
    availability: "in_stock",
    observedAt,
    sourceType: "official_api",
    sourceConfidence: 90,
    soldCount: 12,
    transactionSignal: "sold",
    listingCount: 4,
    reviewCount: 80,
    rating: 4.6,
    priceHistory: [{ price: 42, currency: "USD", observedAt }],
    popularityRank: 18,
    gtin: "012345678905",
    sku: "ACME-1",
    asin: null,
    epid: null,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    ...partial,
  };
}

function fixtureAdapter(
  marketplace: MarketplaceProductCandidate["marketplace"],
  candidates: MarketplaceProductCandidate[],
  enabled = true,
): MarketplaceAdapter {
  return {
    marketplace,
    status: () => ({
      marketplace,
      enabled,
      reason: enabled ? null : "disabled for test",
      sourceType: "official_api",
    }),
    async search(input): Promise<MarketplaceSearchResult> {
      if (!enabled) {
        return {
          status: {
            marketplace,
            enabled: false,
            reason: "disabled for test",
            sourceType: "official_api",
          },
          query: input.query,
          candidates: [],
          fetchedAt: new Date().toISOString(),
          unavailableReason: "disabled for test",
        };
      }
      return {
        status: {
          marketplace,
          enabled: true,
          reason: null,
          sourceType: "official_api",
        },
        query: input.query,
        candidates,
        fetchedAt: new Date().toISOString(),
        unavailableReason: null,
      };
    },
  };
}

async function main() {
  const newsUrl = "https://www.bbc.com/news/business-rate-cut";
  assert(newsLooksLikeProduct("Breaking: markets rally after rate cut", newsUrl), "news title/url is news");
  assert(
    classifyWorldInfo({
      title: "Breaking: markets rally after rate cut",
      url: newsUrl,
      sourceType: "news",
    }) === "NEWS",
    "existing news classifier still marks news as NEWS",
  );
  const newsGate = gateMarketplaceCandidate(
    candidate({
      marketplace: "ebay",
      externalProductId: "news1",
      title: "Breaking: markets rally after rate cut",
      url: newsUrl,
      sourceType: "official_api",
    }),
  );
  assert(!newsGate.ok && newsGate.reason === "news_article", "news is not a product");

  const invalid = gateMarketplaceCandidate(
    candidate({
      marketplace: "amazon",
      externalProductId: "x",
      title: "Widget",
      url: "not-a-url",
    }),
  );
  assert(invalid.reason === "invalid_url", "invalid URL is dropped");

  const unknownSource = gateMarketplaceCandidate(
    candidate({
      marketplace: "amazon",
      externalProductId: "x2",
      title: "Widget",
      url: "https://www.amazon.com/dp/B0TEST1234",
      sourceType: "unknown",
      sourceConfidence: 10,
    }),
  );
  assert(unknownSource.reason === "unknown_source", "unknown source is dropped");

  const fake = evaluateMarketplaceCandidate(
    candidate({
      marketplace: "ebay",
      externalProductId: "fake1",
      title: "Replica designer bag スーパーコピー",
      url: "https://www.ebay.com/itm/fake1",
    }),
  );
  assert(fake.decision === "DISQUALIFY", "counterfeit is disqualified");
  assert(fake.dropReason === "counterfeit_or_legal_risk", "counterfeit reason");

  const noPrice = evaluateMarketplaceCandidate(
    candidate({
      marketplace: "amazon",
      externalProductId: "B0NOPRICE1",
      title: "Acme Widget Official",
      url: "https://www.amazon.co.jp/dp/B0NOPRICE1",
      price: null,
      priceHistory: [],
    }),
  );
  assert(noPrice.factHypothesis.facts.some((fact) => /not provided/i.test(fact.text)), "missing price is a fact, not a guess");
  assert(noPrice.decision !== "STRONG_CANDIDATE", "no price cannot be STRONG_CANDIDATE");

  const noImage = evaluateMarketplaceCandidate(
    candidate({
      marketplace: "mercari",
      externalProductId: "noimg",
      title: "Acme Widget Official",
      url: "https://jp.mercari.com/item/noimg",
      imageUrl: null,
    }),
  );
  assert(
    noImage.factHypothesis.facts.some((fact) => /image URL was not provided/i.test(fact.text)),
    "missing image is recorded",
  );

  const good = candidate({
    marketplace: "ebay",
    externalProductId: "v1|123|0",
    title: "Acme Widget Pro",
    url: "https://www.ebay.com/itm/123",
    brand: "Acme",
    gtin: "012345678905",
  });
  const duplicateKey = marketplaceIdentityKey(good);
  const first = evaluateMarketplaceCandidate(good);
  const existing = evaluateMarketplaceCandidate(good, {
    existingKeys: new Set([duplicateKey]),
  });
  assert(first.existingProduct === false, "first sighting is new");
  assert(existing.existingProduct === true, "existing product is flagged");

  assert(isMarketplaceSellerUrl("https://www.ebay.com/itm/123"), "ebay seller is marketplace");
  assert(isMarketplaceSellerUrl("https://jp.mercari.com/item/x"), "mercari seller is marketplace");
  assert(
    !isMarketplaceSellerUrl("https://acme.test/wholesale"),
    "brand wholesale is not a marketplace seller",
  );

  const adapters = {
    ...createMarketplaceAdapters(),
    ebay: fixtureAdapter("ebay", [
      good,
      candidate({
        marketplace: "ebay",
        externalProductId: "v1|123|0",
        title: "Acme Widget Pro duplicate listing",
        url: "https://www.ebay.com/itm/123?hash=1",
        gtin: "012345678905",
      }),
      candidate({
        marketplace: "ebay",
        externalProductId: "news",
        title: "Breaking: markets rally after rate cut",
        url: newsUrl,
      }),
    ]),
    amazon: fixtureAdapter("amazon", [], false),
    mercari: fixtureAdapter("mercari", [], false),
    yahoo_auction: fixtureAdapter("yahoo_auction", [], false),
  };

  const ebay = marketplaceCorrespondentById("marketplace-ebay");
  assert(ebay, "ebay correspondent exists");

  const pipeline = await runMarketplacePipeline({
    correspondent: ebay,
    adapters,
    existingKeys: new Set(),
    supplier: {
      search: async () => [
        {
          title: "Acme Inc official manufacturer wholesale",
          url: "https://acme.test/wholesale",
          snippet: "MOQ 10. Wholesale $20. Ships to Japan. Authorized manufacturer.",
          sourceName: "acme.test",
        },
        {
          title: "Acme authorized distributor Japan",
          url: "https://distributor.test/brands/acme",
          snippet: "Authorized distributor. Minimum order 100. Price on request.",
          sourceName: "distributor.test",
        },
        {
          title: "Random eBay seller",
          url: "https://www.ebay.com/str/cheapacme",
          snippet: "Buy it now cheap",
          sourceName: "ebay.com",
        },
        {
          title: "Acme factory wholesale",
          url: "https://factory.acme.test/b2b",
          snippet: "Manufacturer wholesale application required. Sample available.",
          sourceName: "factory.acme.test",
        },
      ],
      fetchPage: async (url) => {
        if (url.includes("acme.test/wholesale")) {
          return "Official wholesale. MOQ 10. Wholesale $20. Ships to Japan. Manufacturer.";
        }
        if (url.includes("distributor.test")) {
          return "Authorized distributor. MOQ 100. Apply for wholesale. Lead time 3 weeks.";
        }
        if (url.includes("factory.acme.test")) {
          return "Manufacturer. Sample available. Wholesale application required. MSRP $40.";
        }
        return null;
      },
    },
  });

  const productItem = pipeline.items.find(
    (item) => item.evaluation.candidate.externalProductId === "v1|123|0",
  );
  assert(productItem, "good product was evaluated");
  assert(
    productItem.evaluation.decision === "STRONG_CANDIDATE" ||
      productItem.evaluation.decision === "CANDIDATE",
    `good product should be candidate, got ${productItem.evaluation.decision}`,
  );
  assert(productItem.suppliers, "supplier research must run for candidates");
  assert(
    productItem.suppliers.suppliers.length >= 2,
    `need multiple suppliers, got ${productItem.suppliers.suppliers.length}`,
  );
  assert(
    productItem.suppliers.suppliers.every((row) => !row.marketplaceSeller),
    "marketplace sellers must not become suppliers",
  );
  assert(
    productItem.suppliers.comparison.length >= 2,
    "supplier comparison saved",
  );
  assert(
    productItem.evaluation.factHypothesis.facts.length > 0,
    "facts exist",
  );
  assert(
    productItem.evaluation.factHypothesis.hypotheses.every(
      (item) => !productItem.evaluation.factHypothesis.facts.some((fact) => fact.text === item.text),
    ),
    "facts and hypotheses stay separate",
  );
  assert(productItem.evaluation.humanReview === "pending_human", "human review required");
  assert(pipeline.humanReview === "pending_human", "pipeline waits for human");
  assert(
    productItem.pricesense.entityKind === "product_opportunity",
    "PriceSense output is a product opportunity",
  );
  assert(productItem.pricesense.notALead && productItem.pricesense.notAProspect, "not a lead");
  assert(
    productItem.pricesense.decision === "PURSUE" ||
      productItem.pricesense.decision === "INVESTIGATE",
    "qualification is not auto-emailed",
  );

  const newsItem = pipeline.items.find((item) =>
    item.evaluation.candidate.title.includes("Breaking"),
  );
  assert(!newsItem || newsItem.evaluation.decision === "DISQUALIFY", "news is not a sellable product");
  assert(
    pipeline.drops.some((drop) => drop.reason === "duplicate_product" || drop.reason === "news_article"),
    "drops include duplicate or news",
  );

  const discovery = itemToDiscoveryInput(productItem, "resident-1");
  assert(discovery?.productUrl, "NEWFIND can save a real product candidate");
  assert(discovery?.productImageUrl, "NEWFIND post candidate has image");
  const newsDiscovery = newsItem ? itemToDiscoveryInput(newsItem, "resident-1") : null;
  assert(!newsDiscovery, "NEWFIND does not turn news into a product post");

  const noImageDiscovery = itemToDiscoveryInput(
    {
      evaluation: noImage,
      suppliers: null,
      pricesense: qualifyForPricesense({ evaluation: noImage, suppliers: null }),
    },
    "resident-1",
  );
  assert(!noImageDiscovery, "missing image is not a NEWFIND product post");

  const leadBleed = rejectSalesEntityAsProduct({
    companyName: "Northwind Trading",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    previousStatus: "sent",
  });
  assert(!leadBleed.allowed, "existing lead cannot enter product discovery");
  assert(leadBleed.entityKind === "company", "lead stays a company entity");

  const unknownPriceSupplier = await researchSuppliers(
    good,
    marketplaceIdentityKey(good),
    {
      search: async () => [
        {
          title: "Acme brand official",
          url: "https://acme.test/",
          snippet: "Official brand site. Contact wholesale team.",
        },
      ],
      fetchPage: async () => "Welcome to Acme. Contact us for wholesale.",
    },
  );
  assert(
    unknownPriceSupplier.suppliers[0]?.unitPrice == null,
    "unstated wholesale price stays null",
  );
  assert(
    unknownPriceSupplier.inquiryDrafts[0]?.sendStatus === "pending_human",
    "inquiry is a draft",
  );
  const margin = estimateMargin({
    salePrice: 42,
    saleCurrency: "USD",
    supplier: unknownPriceSupplier.suppliers[0] ?? null,
  });
  assert(margin.marginStatus === "INCOMPLETE", "missing cost is INCOMPLETE");
  assert(margin.estimatedGrossMargin == null, "unknown costs are not zeroed");

  const learned = growthFromLearning([
    {
      correspondentId: "marketplace-ebay",
      query: "japan exclusive",
      marketplace: "ebay",
      identityKey: "x",
      candidateTitle: "saturated gadget market",
      decision: "CANDIDATE",
      confidence: 70,
      humanFeedback: "WRONG_MARKET",
      actualResult: "too much JP competition",
      rejectionReason: null,
      supplierResult: null,
      eventualSalesSignal: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ]);
  const penalized = evaluateMarketplaceCandidate(
    candidate({
      marketplace: "ebay",
      externalProductId: "sat1",
      title: "saturated gadget market extra",
      url: "https://www.ebay.com/itm/sat1",
    }),
    { growth: learned },
  );
  const baseline = evaluateMarketplaceCandidate(
    candidate({
      marketplace: "ebay",
      externalProductId: "sat1",
      title: "saturated gadget market extra",
      url: "https://www.ebay.com/itm/sat1",
    }),
  );
  assert(
    penalized.scores.productScore <= baseline.scores.productScore,
    "WRONG_MARKET learning must not raise the score",
  );

  for (const resident of MARKETPLACE_RESIDENTS) {
    assert(resident.avatarUrl, `${resident.username} needs an avatar`);
    assert(resident.personaName, `${resident.username} needs a persona`);
    assert(resident.username, "username required");
  }

  const disabled = await runMarketplacePipeline({
    correspondent: marketplaceCorrespondentById("marketplace-mercari")!,
    adapters,
  });
  assert(!disabled.adapterEnabled, "mercari stays disabled without official API");
  assert(disabled.items.length === 0, "disabled adapter must not invent products");

  console.log("marketplace pipeline tests passed");
  console.log(
    JSON.stringify({
      decision: productItem.evaluation.decision,
      suppliers: productItem.suppliers.suppliers.map((row) => ({
        name: row.supplierName,
        type: row.supplierType,
        moq: row.moq,
        unitPrice: row.unitPrice,
      })),
      qualification: productItem.pricesense.decision,
      humanReview: productItem.evaluation.humanReview,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
