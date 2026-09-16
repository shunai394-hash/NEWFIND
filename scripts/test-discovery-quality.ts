import { evaluateCaptionQuality } from "../lib/ai/post-quality";
import { classifyProductMatch, extractUrlIdentity } from "../lib/ai/product-identity";
import {
  emptyDiscoveryReport,
  isPostableDiscovery,
  scoreDiscoveryEvidence,
} from "../lib/ai/discovery-report";
import { productFactsAreSufficient } from "../lib/ai/product-page";
import { SPECIALIST_PRODUCT_HUNTERS } from "../lib/ai/specialist-product-hunters";
import { getHunterStrategy, preferredSearchDomains } from "../lib/ai/hunter-strategies";
import { FEATURED_INFLUENCER, FEATURED_LIVING_RESIDENTS } from "../lib/ai/featured-living-residents";
import {
  buildPrecisionHuntQueries,
  huntQueryIsFocused,
} from "../lib/ai/hunter-queries";
import { resultFitsHunterSpecialty, hunterLane } from "../lib/ai/specialty-fit";
import { planNextHunt } from "../lib/ai/explore-next";
import { canonicalProductUrl } from "../lib/discovery/rules";
import { huntModeFromSignals } from "../lib/ai/human-signals";
import { classifyTavilyResult } from "../lib/ai/world-search";
import type { AiPersona } from "../lib/ai-post-engine";

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

  const vibe = evaluateCaptionQuality({
    caption: "空気感が好きなプロダクト。",
  });
  assert(
    !vibe.ok && vibe.reason === "no_concrete_observation",
    "vibe-only caption must fail",
  );

  const templateEn = evaluateCaptionQuality({
    caption: "I want this in front of me today.",
  });
  assert(!templateEn.ok, "English template caption must fail");

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

  const imageOnly = emptyDiscoveryReport({
    brand: "Acme",
    productName: "Widget",
    productUrl: "https://acme.test/products/widget",
    productImageUrl: "https://acme.test/w.jpg",
    officialUrl: "https://acme.test/products/widget",
  });
  imageOnly.evidenceScore = scoreDiscoveryEvidence(imageOnly);
  imageOnly.confidenceScore = 80;
  imageOnly.residentFitScore = 80;
  assert(!isPostableDiscovery(imageOnly), "image without identity/price must not post");

  imageOnly.sku = "W-1";
  imageOnly.evidenceScore = scoreDiscoveryEvidence(imageOnly);
  assert(!isPostableDiscovery(imageOnly), "sku without price must not post");

  imageOnly.price = 24;
  imageOnly.evidenceScore = scoreDiscoveryEvidence(imageOnly);
  assert(isPostableDiscovery(imageOnly), "image plus price must be postable");

  const tracking = canonicalProductUrl(
    "https://www.acme.test/products/widget?utm_source=x&ref=abc&variant=99",
  );
  assert(
    tracking === "https://acme.test/products/widget",
    `tracking params must strip, got ${tracking}`,
  );

  const asin = extractUrlIdentity("https://www.amazon.com/dp/B0ABCDEF12?tag=x");
  assert(asin.asin === "B0ABCDEF12", "ASIN must extract");

  const asinMatch = classifyProductMatch(
    {
      brand: "Anker",
      productName: "Power Bank",
      productUrl: "https://www.amazon.co.jp/dp/B0ABCDEF12",
    },
    [
      {
        id: "dp-asin",
        brand: "Anker",
        productName: "737 Charger",
        category: "tech",
        subcategory: "",
        country: null,
        description: "",
        productImageUrl: "https://anker.test/w.jpg",
        productUrl: "https://www.amazon.com/dp/B0ABCDEF12?ref=x",
        officialUrl: null,
        price: 40,
        currency: "USD",
        sku: null,
        trendScore: 0,
        confidenceScore: 70,
        discoverySource: "ai",
        discoveredAt: new Date().toISOString(),
        attentionReason: "",
        status: "approved",
        normalizedBrand: "anker",
        normalizedProductName: "737 charger",
        trendTags: [],
        sources: [],
        people: [],
        sales: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  );
  assert(asinMatch.kind === "duplicate", "same ASIN must be duplicate");

  const risingOnly = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://acme.test/products/widget-alt",
      trendTags: ["rising"],
    },
    [
      {
        id: "dp-rise",
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
  assert(risingOnly.kind === "duplicate", "rising tag alone must not count as rediscovery");

  const existingWidget = {
    id: "dp-price",
    brand: "Acme",
    productName: "Widget",
    category: "other" as const,
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
    discoverySource: "ai" as const,
    discoveredAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    attentionReason: "",
    status: "approved" as const,
    normalizedBrand: "acme",
    normalizedProductName: "widget",
    trendTags: [] as string[],
    sources: [],
    people: [],
    sales: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const sameDay = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://acme.test/products/widget?utm_source=today",
    },
    [existingWidget],
  );
  assert(sameDay.kind === "duplicate", "yesterday's product with only tracking change is duplicate");

  const priceCut = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://acme.test/products/widget?ref=sale",
      price: 8,
    },
    [existingWidget],
  );
  assert(priceCut.kind === "rediscovery", "20%+ price change must rediscover");

  const restock = classifyProductMatch(
    {
      brand: "Acme",
      productName: "Widget",
      productUrl: "https://www.acme.test/products/widget?color=black",
      attentionReason: "restock / reissue this week",
    },
    [existingWidget],
  );
  assert(restock.kind === "rediscovery", "restock/reissue must rediscover");

  const leoQueries = buildPrecisionHuntQueries({
    residentName: "Leo",
    interests: ["fashion", "shoes", "bags", "accessories"],
    preferredCategories: ["fashion", "accessories", "shoes", "bags"],
    goals: ["find real fashion product pages"],
    expertise: ["fashion"],
    language: "en",
    region: "Milan",
    huntingSpecialty: "silhouette / emerging houses",
    username: "leo_fashion_ai",
    strategy: getHunterStrategy("leo_fashion_ai"),
  });
  assert(leoQueries.length >= 3, "leo must have at least 3 hunt patterns");
  for (const query of leoQueries) {
    assert(huntQueryIsFocused(query.query), `leo query too long: ${query.query}`);
    assert(
      !/sneakers?.+\bbags?\b|\bbags?.+sneakers?/i.test(query.query),
      `leo query dumped mixed category nouns: ${query.query}`,
    );
  }
  const uniqueLeo = new Set(leoQueries.map((item) => item.query));
  assert(uniqueLeo.size >= 3, "leo hunt patterns must not be identical");
  const source = leoQueries.find((item) => item.label === "source");
  assert(source?.includeDomains?.includes("ssense.com"), "leo source hunt must target ssense");

  assert(
    !resultFitsHunterSpecialty({
      title: "Anker 737 Charger",
      url: "https://www.anker.com/products/737-charger",
      snippet: "USB-C power bank",
      username: "leo_fashion_ai",
      strategy: getHunterStrategy("leo_fashion_ai"),
    }),
    "fashion hunter must reject tech charger",
  );
  assert(
    resultFitsHunterSpecialty({
      title: "Anker 737 Charger",
      url: "https://www.anker.com/products/737-charger",
      snippet: "USB-C power bank",
      username: "kai_tech_ai",
      strategy: getHunterStrategy("kai_tech_ai"),
    }),
    "tech hunter must accept charger",
  );
  assert(
    resultFitsHunterSpecialty({
      title: "Atelier leather jacket",
      url: "https://www.ssense.com/en-us/product/atelier-jacket",
      snippet: "cut and construction",
      username: "leo_fashion_ai",
      strategy: getHunterStrategy("leo_fashion_ai"),
    }),
    "fashion hunter must accept jacket PDP",
  );

  assert(
    resultFitsHunterSpecialty({
      title: "Euphoria Men Eau de Toilette 100ml",
      url: "https://world.openbeautyfacts.org/product/0088300178278/eau-de-toilette",
      snippet: "100ml bottle",
      username: "elise_scent_ai",
      strategy: getHunterStrategy("elise_scent_ai"),
    }),
    "fragrance hunter must accept eau de toilette PDP",
  );
  assert(
    !resultFitsHunterSpecialty({
      title: "SOXCO Men's Ankle Socks Cushioned",
      url: "https://www.amazon.com/SOXCO-Ankle-10-Pack-Sports-Cushioned/dp/B0CWTR7XVM",
      snippet: "cushioned socks",
      username: "nico_sneakers_ai",
      strategy: getHunterStrategy("nico_sneakers_ai"),
    }),
    "sneaker hunter must reject socks",
  );
  const domains = preferredSearchDomains(getHunterStrategy("elise_scent_ai"));
  assert(domains.includes("luckyscent.com"), "scent hunter should prefer luckyscent");

  const mockPersona = {
    id: "leo-id",
    profile_id: "leo-profile",
    persona_name: "Leo",
    username: "leo_fashion_ai",
    personality: "x",
    interests: ["fashion"],
    preferred_categories: ["fashion"],
    favorite_brands: [],
    posting_style: "x",
    comment_style: "x",
    activity_level: "high" as const,
    system_prompt: "x",
    expertise: ["fashion"],
  } satisfies AiPersona;

  const deepen = planNextHunt({
    persona: mockPersona,
    signals: {
      posts: 8,
      likes: 20,
      comments: 2,
      saves: 4,
      productSaves: 1,
      likeRate: 250,
      saveRate: 50,
      commentRate: 25,
      discoverySuccess: 80,
    },
  });
  const leave = planNextHunt({
    persona: mockPersona,
    signals: {
      posts: 8,
      likes: 0,
      comments: 0,
      saves: 0,
      productSaves: 0,
      likeRate: 0,
      saveRate: 0,
      commentRate: 0,
      discoverySuccess: 5,
    },
  });
  assert(deepen.theme.includes("deepen"), "successful signals must deepen");
  assert(leave.theme.includes("leave"), "weak signals must leave lane");
  assert(deepen.mode === "deepen" && leave.mode === "leave", "mode must follow signals");
  assert(deepen.includeDomains.length > 0, "deepen must keep preferred domains");
  assert(leave.includeDomains.length === 0, "leave must drop preferred domains");
  assert(
    deepen.vocabulary.join(" ") !== leave.vocabulary.join(" "),
    "leave-lane must rotate different vocabulary",
  );
  const deepenQueries = buildPrecisionHuntQueries({
    residentName: "Leo",
    interests: ["fashion"],
    preferredCategories: ["fashion"],
    goals: ["hunt"],
    language: "en",
    username: "leo_fashion_ai",
    strategy: getHunterStrategy("leo_fashion_ai"),
    nextHunt: deepen,
  });
  const leaveQueries = buildPrecisionHuntQueries({
    residentName: "Leo",
    interests: ["fashion"],
    preferredCategories: ["fashion"],
    goals: ["hunt"],
    language: "en",
    username: "leo_fashion_ai",
    strategy: getHunterStrategy("leo_fashion_ai"),
    nextHunt: leave,
  });
  assert(
    deepenQueries.some((item) => (item.includeDomains ?? []).length > 0),
    "deepen queries must still target preferred domains",
  );
  assert(
    leaveQueries.every((item) => !item.includeDomains?.length),
    "leave queries must not reuse preferred domains",
  );
  assert(huntModeFromSignals(null) === "explore", "no signals means explore");

  const hashUrl = classifyTavilyResult(
    "random",
    "https://cna.st/p/5gn8XrPkbzzdCq8uniETyciDK91cBEt4sT4Fo2qEPngAy3gzeDeYK8tT53nHBxRKdxmXkNApvCntZivP3fjfvekdSP71MXnrEFXTCJmEKdzgzB4458g996Tx5mcoqhfXtaoVFwbfrZu9FoQ9Z2J2F5y4nxgdPe2VxVgy9cbrMWucyFZxZcmQwsRzvKcPpzzM8wSRXnKncLrMWrZMRsa3kLvDZyLeFNdK4EqXX2rFcEZMvzcx5hQLGBSLJoDsjAYPdEqYBL6FGc7xrHaVmbz1UF2XCsRE1u3FZfEu83ikvYnLc5msAEYC8ZCSQrpTGiDs3oWGvFGqbWnszExALx7xKADy4y4Vz5coaEPEoB2wVUecMbBmtmLT3kT8mYNaFoTTL9sHwJhCH4Raiq4jp4paCD5VVMBy8yyQGxb1TxYR8iBqrFfDypZiZtqBAeZGe4iUNeZjWkGER2NtjxCCo3ef1x",
    "buy now",
    "other",
  );
  assert(hashUrl === "general", "opaque CDN hash URLs must not be products");

  const IN_LANE: Record<string, { title: string; url: string; snippet: string }> = {
    beauty: {
      title: "Niacinamide serum",
      url: "https://brand.test/products/niacinamide-serum",
      snippet: "skincare ingredients",
    },
    beauty_tools: {
      title: "LED facial mask",
      url: "https://brand.test/products/led-mask",
      snippet: "beauty device hair dryer",
    },
    fashion: {
      title: "Atelier leather jacket",
      url: "https://www.ssense.com/en-us/product/atelier-jacket",
      snippet: "cut silhouette",
    },
    sneakers: {
      title: "Air Max colorway",
      url: "https://www.nike.com/products/air-max-90",
      snippet: "sneaker drop last",
    },
    tech: {
      title: "USB-C charger",
      url: "https://www.anker.com/products/737-charger",
      snippet: "firmware battery",
    },
    gaming: {
      title: "DualSense controller",
      url: "https://www.playstation.com/products/dualsense",
      snippet: "controller firmware",
    },
    food: {
      title: "regional soy snack",
      url: "https://shop.test/products/soy-snack",
      snippet: "snack flavor",
    },
    home: {
      title: "table lamp",
      url: "https://shop.test/products/table-lamp",
      snippet: "ceramic storage",
    },
    fitness: {
      title: "training shoe",
      url: "https://shop.test/products/training-shoe",
      snippet: "grip session",
    },
    outdoor: {
      title: "ultralight tent",
      url: "https://www.rei.com/products/ultralight-tent",
      snippet: "trail pack",
    },
    japan: {
      title: "made in japan ceramic",
      url: "https://jp.test/products/japan-ceramic",
      snippet: "工房 日本製",
    },
    korea: {
      title: "Seoul maker tray",
      url: "https://www.29cm.co.kr/catalog/products/seoul-tray",
      snippet: "korean independent",
    },
    indie: {
      title: "Brooklyn small batch mug",
      url: "https://needsupply.com/products/brooklyn-mug",
      snippet: "independent us brand",
    },
    eu: {
      title: "Vitra european lamp",
      url: "https://www.vitra.com/products/industrial-lamp",
      snippet: "european industrial design",
    },
    luxury: {
      title: "atelier leather goods",
      url: "https://www.mrporter.com/products/atelier-wallet",
      snippet: "quiet luxury",
    },
    earth: {
      title: "repairable refill bottle",
      url: "https://shop.test/products/refill-bottle",
      snippet: "recycled traceable",
    },
    campus: {
      title: "compact dorm lamp",
      url: "https://www.muji.com/products/dorm-lamp",
      snippet: "student first apartment",
    },
    gift: {
      title: "host gift wrap object",
      url: "https://shop.test/products/host-gift",
      snippet: "seasonal wrap",
    },
    launch: {
      title: "2026 release first edition",
      url: "https://shop.test/products/2026-drop",
      snippet: "just launched new drop",
    },
    archive: {
      title: "reissue original formula",
      url: "https://shop.test/products/archive-reissue",
      snippet: "revival forgotten",
    },
    scent: {
      title: "extrait eau de parfum",
      url: "https://www.luckyscent.com/products/extrait",
      snippet: "perfume notes",
    },
    pet: {
      title: "pet harness",
      url: "https://shop.test/products/pet-harness",
      snippet: "litter chew safe",
    },
    wellness: {
      title: "bath incense",
      url: "https://shop.test/products/bath-oil",
      snippet: "sleep body oil",
    },
    kids: {
      title: "washable kids tableware",
      url: "https://shop.test/products/kids-bowl",
      snippet: "rounded stroller",
    },
    stationery: {
      title: "fountain pen ink",
      url: "https://www.jetpens.com/products/fountain-pen",
      snippet: "notebook paper",
    },
    garden: {
      title: "planter drainage",
      url: "https://shop.test/products/planter",
      snippet: "soil pruner",
    },
    craft: {
      title: "workshop chisel",
      url: "https://shop.test/products/chisel",
      snippet: "yarn dye bench tool",
    },
    world: {
      title: "overseas hidden gem",
      url: "https://shop.test/products/import-object",
      snippet: "not available in japan",
    },
  };
  const CHARGER = {
    title: "Anker 737 Charger",
    url: "https://www.anker.com/products/737-charger",
    snippet: "USB-C power bank firmware",
  };
  const JACKET = {
    title: "Atelier leather jacket",
    url: "https://www.ssense.com/en-us/product/atelier-jacket",
    snippet: "cut silhouette",
  };

  for (const hunter of SPECIALIST_PRODUCT_HUNTERS) {
    const strategy = getHunterStrategy(hunter.username);
    const lane = hunterLane(hunter.username, hunter.huntingSpecialty);
    assert(lane, `${hunter.username} must have a specialty lane`);
    const inLane = IN_LANE[lane!];
    assert(inLane, `${hunter.username} missing in-lane fixture for ${lane}`);
    assert(
      resultFitsHunterSpecialty({
        ...inLane,
        username: hunter.username,
        huntingSpecialty: hunter.huntingSpecialty,
        strategy,
      }),
      `${hunter.username} must accept in-lane PDP (${lane})`,
    );
    if (lane !== "world") {
      const offLane = ["tech", "gaming"].includes(lane!) ? JACKET : CHARGER;
      assert(
        !resultFitsHunterSpecialty({
          ...offLane,
          username: hunter.username,
          huntingSpecialty: hunter.huntingSpecialty,
          strategy,
        }),
        `${hunter.username} must reject off-lane ${offLane.title}`,
      );
    }
    const queries = buildPrecisionHuntQueries({
      residentName: hunter.personaName,
      interests: hunter.interests ?? [],
      preferredCategories: hunter.preferredCategories ?? [],
      goals: hunter.goals ?? [],
      expertise: hunter.expertise,
      language: hunter.languages?.[0],
      username: hunter.username,
      huntingSpecialty: hunter.huntingSpecialty,
      strategy,
    });
    assert(queries.length >= 3, `${hunter.username} needs 3 hunt patterns`);
    assert(
      new Set(queries.map((item) => item.query)).size >= 3,
      `${hunter.username} hunt patterns must be distinct: ${queries.map((item) => item.query).join(" || ")}`,
    );
  }

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
