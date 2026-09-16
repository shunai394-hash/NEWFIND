import { evaluateCaptionQuality } from "../lib/ai/post-quality";
import { classifyProductMatch } from "../lib/ai/product-identity";
import {
  emptyDiscoveryReport,
  isPostableDiscovery,
  scoreDiscoveryEvidence,
} from "../lib/ai/discovery-report";
import { productFactsAreSufficient } from "../lib/ai/product-page";
import { SPECIALIST_PRODUCT_HUNTERS } from "../lib/ai/specialist-product-hunters";
import { getHunterStrategy } from "../lib/ai/hunter-strategies";
import { FEATURED_INFLUENCER, FEATURED_LIVING_RESIDENTS } from "../lib/ai/featured-living-residents";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  const generic = evaluateCaptionQuality({
    caption: "今日見つけたこれ、ちょっと気になる。",
    recentCaptions: [],
  });
  assert(!generic.ok && generic.reason === "generic_caption", "generic caption must fail");

  const unique = evaluateCaptionQuality({
    caption: "この靴底の減り方を見ると、通勤用としてはまだ早い。",
    recentCaptions: ["別の住民の投稿です。カットが先に残る。"],
  });
  assert(unique.ok, "specific caption must pass");

  const similar = evaluateCaptionQuality({
    caption: "この靴底の減り方を見ると、通勤用としてはまだ早い。",
    recentCaptions: ["この靴底の減り方を見ると、通勤用としてはまだ早い。"],
  });
  assert(!similar.ok, "duplicate caption must fail");

  const sameUrl = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://www.acme.test/products/widget?utm_source=x",
    },
    [
      {
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
        discoveredAt: new Date().toISOString(),
        attentionReason: "",
        status: "pending",
        normalizedBrand: "acme",
        normalizedProductName: "widget",
        trendTags: [],
        sources: [],
        people: [],
        sales: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  );
  assert(sameUrl.kind === "duplicate", "same product different tracking URL must be duplicate");

  const rediscovery = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://acme.test/products/widget-blue",
      attentionReason: "new colorway just dropped",
      trendTags: ["new_release"],
      price: 10,
    },
    [
      {
        id: "dp2",
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
        discoveredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        attentionReason: "",
        status: "approved",
        normalizedBrand: "acme",
        normalizedProductName: "widget",
        trendTags: [],
        sources: [],
        people: [],
        sales: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  );
  assert(rediscovery.kind === "rediscovery", "new color after a month should be rediscovery");

  const thin = emptyDiscoveryReport({
    brand: "Acme",
    productName: "Widget",
    productUrl: "https://acme.test/products/widget",
  });
  thin.evidenceScore = scoreDiscoveryEvidence(thin);
  assert(!isPostableDiscovery(thin), "thin report must not be postable");

  const facts = productFactsAreSufficient({
    brand: "Acme",
    productName: "Widget",
    description: "Steel widget, 200g",
    sku: "W-1",
    gtin: null,
    modelNumber: null,
    price: 20,
    currency: "USD",
    launchDate: null,
    officialUrl: "https://acme.test/products/widget",
    imageUrl: "https://acme.test/w.jpg",
  });
  assert(facts, "page facts with image+sku must be sufficient");

  const newsFacts = productFactsAreSufficient({
    brand: null,
    productName: "Markets rise",
    description: null,
    sku: null,
    gtin: null,
    modelNumber: null,
    price: null,
    currency: null,
    launchDate: null,
    officialUrl: null,
    imageUrl: null,
  });
  assert(!newsFacts, "news-like facts must be insufficient");

  const named = [
    ...FEATURED_LIVING_RESIDENTS,
    FEATURED_INFLUENCER,
    ...SPECIALIST_PRODUCT_HUNTERS,
  ];
  for (const resident of named) {
    assert(resident.avatarUrl, `${resident.username} needs avatar`);
    assert(resident.residentRole, `${resident.username} needs role`);
    assert((resident.expertise ?? []).length > 0, `${resident.username} needs expertise`);
  }

  const missingStrategy = SPECIALIST_PRODUCT_HUNTERS.filter(
    (hunter) => !getHunterStrategy(hunter.username),
  );
  assert(
    missingStrategy.length === 0,
    `hunters missing strategy: ${missingStrategy.map((item) => item.username).join(", ")}`,
  );

  const usernames = named.map((item) => item.username);
  assert(
    new Set(usernames).size === usernames.length,
    "named residents must have unique usernames",
  );

  console.log("CHECK PASSED");
  console.log(`specialist hunters: ${SPECIALIST_PRODUCT_HUNTERS.length}`);
  console.log(`featured living: ${FEATURED_LIVING_RESIDENTS.length}`);
  console.log("Noa influencer remains named:", FEATURED_INFLUENCER.username);
}

main();
