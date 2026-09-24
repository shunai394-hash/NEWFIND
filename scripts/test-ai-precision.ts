import { classifyTavilyResult } from "../lib/ai/world-search";
import { htmlIndicatesConcreteProduct, htmlIndicatesListingPage } from "../lib/ai/product-page";
import { resultFitsHunterSpecialty } from "../lib/ai/specialty-fit";
import { classifyProductMatch } from "../lib/ai/product-identity";
import { evaluateSalesTarget } from "../lib/ai/entity-verification";
import { canonicalizeSourceUrl } from "../lib/ai/agent-os/hash";
import { sourceReliabilityLabel } from "../lib/ai/agent-os/quality";
import { funnelSummary, emptyFunnel, recordDrop, createPipelineTrace } from "../lib/ai/pipeline-trace";
import type { DiscoveryProduct } from "../lib/discovery/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function productFixture(overrides: Partial<DiscoveryProduct> = {}): DiscoveryProduct {
  const now = new Date().toISOString();
  return {
    id: "dp1",
    brand: "Acme",
    productName: "Widget",
    category: "other",
    subcategory: "",
    country: null,
    description: "",
    productImageUrl: "https://acme.test/w.jpg",
    productUrl: "https://acme.test/products/widget",
    officialUrl: null,
    price: 12,
    currency: "USD",
    sku: null,
    trendScore: 0,
    confidenceScore: 70,
    discoverySource: "ai",
    discoveredAt: now,
    attentionReason: "",
    status: "pending",
    normalizedBrand: "acme",
    normalizedProductName: "widget",
    trendTags: [],
    sources: [],
    people: [],
    sales: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function main() {
  const cases: Array<{
    name: string;
    title: string;
    url: string;
    snippet: string;
    sourceType: "brand_official" | "retailer" | "news" | "sns" | "blog" | "other";
    expected: "product" | "news" | "general";
  }> = [
    {
      name: "official product page",
      title: "Aesop Parsley Seed Serum",
      url: "https://www.aesop.com/products/parsley-seed-anti-oxidant-serum",
      snippet: "Add to bag. Price 63. 60ml ingredients.",
      sourceType: "other",
      expected: "product",
    },
    {
      name: "brand PDP without /products/",
      title: "Gypsy Water Eau de Parfum",
      url: "https://www.byredo.com/en-us/gypsy-water",
      snippet: "Eau de parfum. Buy now. 50ml. Price 180.",
      sourceType: "other",
      expected: "product",
    },
    {
      name: "shopify collection product",
      title: "Ceramic mug",
      url: "https://shop.example.com/collections/table/products/ceramic-mug",
      snippet: "Add to cart. Price 24.",
      sourceType: "other",
      expected: "product",
    },
    {
      name: "category page",
      title: "Skincare",
      url: "https://www.examplebrand.com/category/skincare",
      snippet: "Shop all serums. Price from 20.",
      sourceType: "retailer",
      expected: "general",
    },
    {
      name: "search page",
      title: "Search results",
      url: "https://www.examplebrand.com/search?q=serum",
      snippet: "Buy serum. Price list.",
      sourceType: "retailer",
      expected: "general",
    },
    {
      name: "news article",
      title: "Brand launches new serum",
      url: "https://www.reuters.com/lifestyle/brand-launches-serum",
      snippet: "The company said the product will go on sale.",
      sourceType: "news",
      expected: "news",
    },
    {
      name: "sns",
      title: "Brand on Instagram",
      url: "https://www.instagram.com/p/abc123/",
      snippet: "Buy now",
      sourceType: "sns",
      expected: "general",
    },
    {
      name: "garbage url",
      title: "Deal",
      url: "https://cna.st/p/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      snippet: "Buy now price",
      sourceType: "other",
      expected: "general",
    },
    {
      name: "collection listing",
      title: "Summer collection",
      url: "https://www.examplebrand.com/collections/summer",
      snippet: "Shop the collection. Price range.",
      sourceType: "other",
      expected: "general",
    },
    {
      name: "affiliate tracking /t/ path",
      title: "redirect",
      url: "https://www.pntrs.com/t/8-12090-147620-177210?url=https://shop.example.com/products/x",
      snippet: "Buy now. Price 20.",
      sourceType: "other",
      expected: "general",
    },
    {
      name: "pdf spec sheet",
      title: "Datasheet",
      url: "https://www.bhphotovideo.com/lit_files/23003.pdf",
      snippet: "Buy this product. Price and sku.",
      sourceType: "retailer",
      expected: "general",
    },
    {
      name: "brand about page",
      title: "About us",
      url: "https://www.examplebrand.com/en-us/about-us",
      snippet: "Buy our products. Price list.",
      sourceType: "other",
      expected: "general",
    },
  ];

  for (const testCase of cases) {
    const actual = classifyTavilyResult(
      testCase.title,
      testCase.url,
      testCase.snippet,
      testCase.sourceType,
    );
    assert(
      actual === testCase.expected,
      `${testCase.name}: expected ${testCase.expected}, got ${actual}`,
    );
  }

  const productHtml = `
    <html><head>
      <meta property="og:type" content="product" />
      <script type="application/ld+json">{"@type":"Product","name":"Serum","brand":"Aesop","offers":{"price":"63","priceCurrency":"USD"}}</script>
    </head></html>
  `;
  assert(htmlIndicatesConcreteProduct(productHtml), "product schema HTML must count as product");
  assert(!htmlIndicatesListingPage(productHtml), "product schema is not a listing");

  const collectionHtml = `
    <html><head>
      <script type="application/ld+json">{"@type":"CollectionPage","name":"Summer"}</script>
    </head></html>
  `;
  assert(htmlIndicatesListingPage(collectionHtml), "CollectionPage must be listing");
  assert(!htmlIndicatesConcreteProduct(collectionHtml), "CollectionPage must not be a product");

  assert(
    resultFitsHunterSpecialty({
      title: "Niacinamide serum",
      url: "https://brand.test/products/niacinamide-serum",
      snippet: "skincare ingredients",
      username: "mira_beauty_ai",
      huntingSpecialty: "cosmetics / skincare",
    }),
    "Beauty Hunter must prefer beauty PDPs",
  );
  assert(
    !resultFitsHunterSpecialty({
      title: "USB-C charger",
      url: "https://www.anker.com/products/737-charger",
      snippet: "firmware battery",
      username: "mira_beauty_ai",
      huntingSpecialty: "cosmetics / skincare",
    }),
    "Beauty Hunter must reject tech",
  );
  assert(
    resultFitsHunterSpecialty({
      title: "Atelier leather jacket",
      url: "https://www.ssense.com/en-us/product/atelier-jacket",
      snippet: "cut silhouette",
      username: "leo_fashion_ai",
      huntingSpecialty: "silhouette / emerging houses",
    }),
    "Fashion Hunter must prefer fashion PDPs",
  );
  assert(
    resultFitsHunterSpecialty({
      title: "USB-C charger",
      url: "https://www.anker.com/products/737-charger",
      snippet: "firmware battery",
      username: "kai_tech_ai",
      huntingSpecialty: "startup hardware",
    }),
    "Tech Hunter must prefer tech PDPs",
  );

  const existing = [productFixture()];
  const sameProduct = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://www.acme.test/products/widget?utm_source=x",
    },
    existing,
  );
  assert(sameProduct.kind === "duplicate", "existing product URL variants must be duplicate");

  const otherRetailer = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://shop.retailer.test/products/widget",
    },
    existing,
  );
  assert(
    otherRetailer.kind === "duplicate" || otherRetailer.kind === "rediscovery",
    "same brand+name on another URL must not be treated as a brand-new entity",
  );

  const sent = evaluateSalesTarget({
    companyName: "Northwind",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    previousStatus: "sent",
  });
  assert(sent.status === "skip", "already-sent company must skip");

  const excluded = evaluateSalesTarget({
    companyName: "Northwind",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    previousStatus: "excluded",
  });
  assert(excluded.status === "skip", "excluded company must skip");

  const fakeCompany = evaluateSalesTarget({
    companyName: "Acme",
    officialUrl: null,
    officialSiteVerified: false,
  });
  assert(fakeCompany.status === "reject", "fabricated company must reject");

  const fakeEmail = evaluateSalesTarget({
    companyName: "Northwind Trading",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    email: "ceo@northwindtrading.com",
    emailSource: "generated",
  });
  assert(fakeEmail.status === "reject", "generated email must reject");

  const verified = evaluateSalesTarget({
    companyName: "Northwind Trading",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    email: "press@northwindtrading.com",
    emailSource: "extracted",
    sources: [{ url: "https://northwindtrading.com/about", verified: true }],
  });
  assert(verified.status === "candidate", "official verified company must be a candidate");

  assert(
    canonicalizeSourceUrl("https://WWW.Acme.test/products/widget?utm_source=x") ===
      canonicalizeSourceUrl("https://acme.test/products/widget"),
    "tracking params must not create a new source identity",
  );

  assert(
    sourceReliabilityLabel({ sourceType: "brand_official", sourceRole: "product" }) ===
      "official_product_page",
    "official product pages must be labeled as such",
  );
  assert(
    sourceReliabilityLabel({ sourceType: "sns" }) === "sns",
    "sns must not be treated as official",
  );

  const trace = createPipelineTrace({ actorName: "Mira", actorRole: "product_hunter" });
  trace.funnel.searchResults = 18;
  trace.funnel.productCandidates = 7;
  trace.funnel.qualityPass = 4;
  recordDrop(trace, { reason: "DUPLICATE" });
  trace.funnel.saved = 2;
  const summary = funnelSummary(trace.funnel);
  assert(summary.includes("search=18"), "funnel must expose search count");
  assert(summary.includes("product=7"), "funnel must expose product count");
  assert(summary.includes("saved=2"), "funnel must expose saved count");
  assert(emptyFunnel().searchResults === 0, "empty funnel starts at zero");

  console.log("AI precision tests passed");
}

main();
