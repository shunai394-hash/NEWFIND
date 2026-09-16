import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type HunterDrySpec = {
  personaName: string;
  username: string;
  huntingSpecialty: string;
  interests: string[];
  preferredCategories: string[];
  goals: string[];
  expertise: string[];
  values: string[];
  favoriteBrands: string[];
  country: string;
  region: string;
  language: string;
};

const HUNTERS: HunterDrySpec[] = [
  {
    personaName: "Fashion Hunter",
    username: "leo_fashion_ai",
    huntingSpecialty: "silhouette / emerging houses",
    interests: [
      "fashion",
      "shoes",
      "bags",
      "accessories",
      "independent labels",
      "emerging brands",
    ],
    preferredCategories: ["fashion", "accessories", "shoes", "bags"],
    goals: ["find real fashion product pages"],
    expertise: ["fashion", "shoes", "bags"],
    values: ["design", "brand-story"],
    favoriteBrands: ["independent houses", "emerging ateliers"],
    country: "IT",
    region: "Milan",
    language: "en",
  },
  {
    personaName: "Beauty Hunter",
    username: "mira_beauty_ai",
    huntingSpecialty: "cosmetics / skincare",
    interests: [
      "cosmetics",
      "skincare",
      "fragrance",
      "beauty",
      "ingredients",
      "new brands",
    ],
    preferredCategories: ["beauty", "fragrance", "cosmetics", "skincare"],
    goals: ["find real beauty product pages"],
    expertise: ["cosmetics", "skincare", "fragrance", "beauty"],
    values: ["quality", "innovation"],
    favoriteBrands: ["independent formula labs", "Seoul beauty ateliers"],
    country: "KR",
    region: "Seoul",
    language: "en",
  },
  {
    personaName: "Tech Hunter",
    username: "kai_tech_ai",
    huntingSpecialty: "startup hardware",
    interests: [
      "gadgets",
      "electronics",
      "audio",
      "smart devices",
      "startups",
    ],
    preferredCategories: ["tech", "gadgets", "electronics", "audio"],
    goals: ["find real gadget product pages"],
    expertise: ["gadgets", "electronics", "audio"],
    values: ["innovation", "performance"],
    favoriteBrands: ["hardware startups", "independent audio makers"],
    country: "DE",
    region: "Berlin",
    language: "en",
  },
];

async function main() {
  const tavily = Boolean(process.env.TAVILY_API_KEY);
  const groq = Boolean(process.env.GROQ_API_KEY);
  console.log(`tavilyConfigured=${tavily} groqConfigured=${groq}`);

  const {
    classifyTavilyResult,
    isLiveWorldProduct,
    isNewsSignal,
    isProductSource,
    searchWorld,
  } = await import("../lib/ai/world-search");
  const { buildPrecisionHuntQueries, huntQueryIsFocused } = await import(
    "../lib/ai/hunter-queries"
  );
  const { getHunterStrategy } = await import("../lib/ai/hunter-strategies");
  const { resultFitsHunterSpecialty } = await import("../lib/ai/specialty-fit");

  const cases = [
    {
      name: "news article",
      title: "Markets rise on fashion week news",
      url: "https://www.reuters.com/world/fashion-week",
      snippet: "News about brands",
      sourceType: "news" as const,
      expected: "news",
    },
    {
      name: "store homepage",
      title: "Official Store",
      url: "https://www.examplebrand.com/",
      snippet: "Buy products. Price list.",
      sourceType: "other" as const,
      expected: "general",
    },
    {
      name: "category page",
      title: "Shoes",
      url: "https://www.examplebrand.com/category/shoes",
      snippet: "Shop shoes",
      sourceType: "retailer" as const,
      expected: "general",
    },
    {
      name: "search page",
      title: "Search results",
      url: "https://www.examplebrand.com/search?q=jacket",
      snippet: "Results for jacket",
      sourceType: "retailer" as const,
      expected: "general",
    },
    {
      name: "product page",
      title: "Air Max 90",
      url: "https://www.nike.com/t/air-max-90/product/foo",
      snippet: "Buy now. Size chart. Price 130.",
      sourceType: "other" as const,
      expected: "product",
    },
    {
      name: "collection listing",
      title: "Summer collection",
      url: "https://www.examplebrand.com/collections/summer",
      snippet: "See the collection",
      sourceType: "other" as const,
      expected: "general",
    },
    {
      name: "sns profile",
      title: "Brand on Instagram",
      url: "https://www.instagram.com/examplebrand/",
      snippet: "Follow us",
      sourceType: "sns" as const,
      expected: "general",
    },
  ];

  let passed = 0;
  for (const testCase of cases) {
    const actual = classifyTavilyResult(
      testCase.title,
      testCase.url,
      testCase.snippet,
      testCase.sourceType,
    );
    const ok = actual === testCase.expected;
    if (ok) passed += 1;
    console.log(
      `CLASSIFY ${ok ? "PASS" : "FAIL"}: ${testCase.name} -> ${actual} (expected ${testCase.expected})`,
    );
  }
  console.log(`URL classification ${passed}/${cases.length}`);

  const mikaLike = (await import("../lib/ai/world-search")).buildResidentSearchQuery({
    residentName: "Mika",
    interests: ["beauty", "fragrance", "trends", "cafes", "lifestyle", "travel"],
    preferredCategories: ["beauty", "fragrance", "lifestyle"],
    goals: ["新しい商品を見つける"],
    expertise: ["beauty", "fragrance"],
    country: "JP",
    language: "ja",
    favoriteBrands: [],
    region: "Japan",
  });
  const queryNoise = /cafes?|travel|trends?|lifestyle/i.test(mikaLike.query);
  console.log(
    `QUERY Mika-like ${queryNoise ? "FAIL" : "PASS"}: ${mikaLike.query}`,
  );
  if (queryNoise) {
    throw new Error("hunter query still contains lifestyle noise");
  }

  // Nike /t/ path is not a PRODUCT_PATH. Use /products/ for a fair product-page case.
  const productPathActual = classifyTavilyResult(
    "Air Max 90",
    "https://www.nike.com/products/air-max-90",
    "Buy now. Size chart. Price 130.",
    "other",
  );
  console.log(
    `CLASSIFY extra product path: ${productPathActual} (expected product)`,
  );

  if (!tavily) {
    console.log("skip live world search: TAVILY_API_KEY missing");
    return;
  }

  let evaluateProductCandidates:
    | ((typeof import("../lib/ai/product-hunter"))["evaluateProductCandidates"])
    | null = null;
  if (groq) {
    ({ evaluateProductCandidates } = await import("../lib/ai/product-hunter"));
  }

  for (const hunter of HUNTERS) {
    const queries = buildPrecisionHuntQueries({
      residentName: hunter.personaName,
      interests: hunter.interests,
      preferredCategories: hunter.preferredCategories,
      goals: hunter.goals,
      expertise: hunter.expertise,
      values: hunter.values,
      country: hunter.country,
      language: hunter.language,
      favoriteBrands: hunter.favoriteBrands,
      region: hunter.region,
      huntingSpecialty: hunter.huntingSpecialty,
      username: hunter.username,
      strategy: getHunterStrategy(hunter.username),
    });

    console.log("\n========================================");
    console.log(`HUNTER ${hunter.personaName}`);
    for (const query of queries) {
      const focused = huntQueryIsFocused(query.query);
      console.log(
        `query[${query.label}] focused=${focused} domains=${(query.includeDomains ?? []).join(",") || "-"}: ${query.query}`,
      );
      if (!focused) {
        throw new Error(`${hunter.personaName} query is not focused: ${query.query}`);
      }
    }

    const results = (
      await Promise.all(
        queries.map((query) =>
          searchWorld({
            ...query,
            residentId: "dry-run",
            residentName: hunter.personaName,
          }),
        ),
      )
    ).flat();

    const uniqueResults: typeof results = [];
    const seen = new Set<string>();
    for (const result of results) {
      const key = result.url.replace(/\/$/, "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueResults.push(result);
    }

    const strategy = getHunterStrategy(hunter.username);
    const web = uniqueResults.filter((result) => result.origin === "web");
    const extracted = uniqueResults.filter((result) => result.origin === "extracted");
    const obf = uniqueResults.filter((result) => result.origin === "open_beauty_facts");
    const catalog = uniqueResults.filter((result) => result.origin === "catalog");
    const news = uniqueResults.filter(isNewsSignal);
    const products = uniqueResults.filter(isProductSource);
    const liveProducts = uniqueResults.filter(isLiveWorldProduct);
    const inLane = liveProducts.filter((result) =>
      resultFitsHunterSpecialty({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        username: hunter.username,
        huntingSpecialty: hunter.huntingSpecialty,
        strategy,
      }),
    );
    const general = uniqueResults.filter((result) => result.sourceRole === "general");
    const rejected = uniqueResults.filter((result) => result.sourceRole !== "product");

    console.log(
      `counts web=${web.length} extracted=${extracted.length} obf=${obf.length} catalog=${catalog.length}`,
    );
    console.log(
      `roles product=${products.length} liveProduct=${liveProducts.length} inLane=${inLane.length} news=${news.length} general=${general.length}`,
    );

    console.log("LIVE PRODUCT URLS:");
    for (const result of liveProducts) {
      const lane = inLane.includes(result) ? "in-lane" : "off-lane";
      console.log(
        `- [${result.origin}/${lane}] ${result.title} | ${result.url} | image=${result.imageUrl ? "yes" : "none"}`,
      );
    }

    console.log("REJECTED / NON-PRODUCT:");
    for (const result of rejected.slice(0, 12)) {
      console.log(
        `- [${result.origin ?? "web"}/${result.sourceRole}] ${result.title} | ${result.url}`,
      );
    }

    if (!evaluateProductCandidates) {
      console.log("skip candidate evaluation: GROQ_API_KEY missing");
      continue;
    }

    const candidates = await evaluateProductCandidates({
      residentId: "dry-run",
      residentName: hunter.personaName,
      personality: `${hunter.personaName} hunts real products.`,
      interests: hunter.interests,
      preferredCategories: hunter.preferredCategories,
      goals: hunter.goals,
      expertise: hunter.expertise,
      values: hunter.values,
      region: hunter.region,
      languages: [hunter.language],
      culture: hunter.region,
      huntingSpecialty: hunter.huntingSpecialty,
      hunterUsername: hunter.username,
      results: uniqueResults,
    });

    console.log(`CANDIDATES ${candidates.length}`);
    for (const candidate of candidates) {
      console.log({
        origin: candidate.origin,
        brand: candidate.brand,
        productName: candidate.productName,
        productUrl: candidate.productUrl,
        productImageUrl: candidate.productImageUrl,
        confidenceScore: candidate.confidenceScore,
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
