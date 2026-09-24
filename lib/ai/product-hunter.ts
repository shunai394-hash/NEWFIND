import { isUsableProductImage } from "@/lib/discovery/media";
import { canonicalProductUrl } from "@/lib/discovery/rules";
import { generateAIText } from "./groq";
import {
  extractProductFactsFromHtml,
  extractProductImageFromHtml,
  fetchPageHtml,
  isAcceptableProductPageImage,
  productFactsAreSufficient,
} from "./product-page";
import {
  emptyDiscoveryReport,
  scoreDiscoveryEvidence,
  type DiscoveryReport,
} from "./discovery-report";
import {
  isLiveWorldProduct,
  isNewsSignal,
  isProductSource,
  type WorldSearchOrigin,
  type WorldSearchResult,
} from "./world-search";
import type { DiscoveryCategory, TrendTag } from "@/lib/discovery/types";
import { getHunterStrategy, preferredSearchDomains } from "@/lib/ai/hunter-strategies";
import {
  isMarketplaceProductUrl,
  resultFitsHunterSpecialty,
  specialtyFitScore,
} from "@/lib/ai/specialty-fit";
import {
  createPipelineTrace,
  markPipelineEvent,
  recordDrop,
  type PipelineTrace,
} from "@/lib/ai/pipeline-trace";
import {
  sourceReliabilityLabel,
  isWeakReliability,
} from "@/lib/ai/agent-os/quality";

export type ProductHunterInput = {
  residentId: string;
  residentName: string;
  personality: string;
  interests: string[];
  preferredCategories: string[];
  goals: string[];
  expertise?: string[];
  values?: string[];
  region?: string | null;
  languages?: string[];
  culture?: string | null;
  huntingSpecialty?: string;
  hunterUsername?: string;
  results: WorldSearchResult[];
  trace?: PipelineTrace;
};

export type ProductHunterCandidate = {
  brand: string;
  productName: string;
  category: DiscoveryCategory;
  subcategory: string;
  country: string | null;
  description: string;
  productUrl: string;
  officialUrl: string | null;
  productImageUrl: string | null;
  currency: string;
  price: number | null;
  sku: string | null;
  gtin: string | null;
  modelNumber: string | null;
  launchDate: string | null;
  attentionReason: string;
  trendTags: TrendTag[];
  trendScore: number;
  confidenceScore: number;
  origin: WorldSearchOrigin;
  report: DiscoveryReport;
};

const CATEGORIES = new Set<string>([
  "fashion",
  "beauty",
  "accessories",
  "fragrance",
  "japan_brand",
  "celebrity_style",
  "anime_culture",
  "lifestyle",
  "food",
  "travel",
  "home",
  "tech",
  "sports",
  "other",
]);

const TREND_TAGS = new Set<string>([
  "celebrity_pick",
  "viral",
  "trending",
  "rising",
  "new_release",
  "best_seller",
  "gen_z_trend",
  "world_trend",
  "japan_trend",
  "us_trend",
  "korea_trend",
  "uk_trend",
  "re_discovered",
  "editorial_pick",
  "hidden_gem",
  "luxury",
  "teen",
  "high_school",
  "y2k",
  "streetwear",
]);

function safeCategory(value: unknown): DiscoveryCategory {
  const category = String(value ?? "").trim().toLowerCase();
  return CATEGORIES.has(category)
    ? (category as DiscoveryCategory)
    : "other";
}

function safeTrendTags(value: unknown): TrendTag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => TREND_TAGS.has(item)) as TrendTag[];
}

function safeScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function safePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLikelyConcreteProduct(
  candidate: Record<string, unknown>,
  source: WorldSearchResult,
): boolean {
  const productName = safeString(candidate.productName).toLowerCase();
  const brand = safeString(candidate.brand).toLowerCase();
  const description = safeString(candidate.description).toLowerCase();
  const title = source.title.toLowerCase();
  const snippet = source.snippet.toLowerCase();
  const url = source.url.toLowerCase();

  if (
    /openbeautyfacts\.org/i.test(url) &&
    /\/product\/[a-z0-9]/i.test(url)
  ) {
    return true;
  }

  const genericListingPatterns = [
    "category",
    "categories",
    "collection",
    "collections",
    "catalog",
    "search",
    "archive",
    "blog",
    "article",
    "news",
    "editorial",
    "magazine",
    "press release",
    "event",
  ];
  const genericShopPatterns = ["shop", "store"];
  const genericPageText = `${productName} ${title}`.trim();
  const hasProductPath =
    /\/products?(?:\/|$)|\/items?(?:\/|$)|\/shop\/[^/?#]+|\/store\/[^/?#]+|\/p\/[^/?#]+|\/dp\/[a-z0-9]+|\/gp\/product\/[a-z0-9]+|\/goods\/[^/?#]+|\/pd\/[^/?#]+/u.test(
      url,
    );

  if (genericListingPatterns.some((pattern) => genericPageText.includes(pattern))) {
    console.log(
      "PRODUCT HUNTER: rejected generic/non-product page:",
      productName,
      source.url,
    );
    return false;
  }

  if (
    !hasProductPath &&
    genericShopPatterns.some((pattern) => genericPageText.includes(pattern))
  ) {
    console.log(
      "PRODUCT HUNTER: rejected generic/non-product page:",
      productName,
      source.url,
    );
    return false;
  }

  const nonTargetContentPatterns = [
    /hardcover book/i,
    /paperback book/i,
    /\be-?books?\b/i,
    /\bkindle\b/i,
    /magazine issue/i,
    /\bbooks?\b/i,
    /\bnovels?\b/i,
    /\bcomics?\b/i,
    /electronic book/i,
  ];
  if (
    nonTargetContentPatterns.some((pattern) =>
      pattern.test(`${description} ${title} ${snippet} ${productName}`),
    )
  ) {
    console.log(
      "PRODUCT HUNTER: rejected non-target content:",
      productName,
      source.url,
    );
    return false;
  }

  const productEvidence = [
    productName,
    brand,
    description,
    title,
    snippet,
    url,
  ].join(" ");

  const hasPurchaseSignal =
    /add to cart|add to bag|buy now|shop now|price|sku|ingredients|volume|ml|oz|size|color|colour|カート|購入|価格|容量|成分/u.test(
      productEvidence,
    );

  if (!hasPurchaseSignal && !hasProductPath) {
    console.log(
      "PRODUCT HUNTER: insufficient concrete product evidence:",
      productName,
      source.url,
    );
    return false;
  }

  return true;
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function formatSearchRow(
  result: WorldSearchResult,
  index: number,
  kind: "news" | "product",
) {
  const label =
    kind === "news" ? "NEWS SIGNAL" : "PRODUCT SOURCE";

  return [
    `${label} ${index + 1}`,
    `Title: ${result.title}`,
    `URL: ${result.url}`,
    `Domain: ${result.domain}`,
    `Source type: ${result.sourceType}`,
    `Source role: ${result.sourceRole ?? kind}`,
    `Origin: ${result.origin ?? "web"}`,
    result.language ? `Language: ${result.language}` : "",
    result.sourceCountry ? `Country: ${result.sourceCountry}` : "",
    result.publishedAt ? `Published: ${result.publishedAt}` : "",
    kind === "news" && result.imageUrl
      ? "News image available for visual context only. Do not use it as productImageUrl."
      : "",
    `Snippet: ${result.snippet.slice(0, 250)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSearchContext(
  news: WorldSearchResult[],
  products: WorldSearchResult[],
): string {
  const liveProducts = products.filter(isLiveWorldProduct);
  const catalogProducts = products.filter(
    (result) => result.origin === "catalog",
  );
  const promptProducts = liveProducts.length > 0 ? liveProducts : catalogProducts;

  const newsBlock = news
    .slice(0, 8)
    .map((result, index) => formatSearchRow(result, index, "news"))
    .join("\n\n");

  const productBlock = promptProducts
    .slice(0, 8)
    .map((result, index) => formatSearchRow(result, index, "product"))
    .join("\n\n");

  const productHeader =
    liveProducts.length > 0
      ? "WEB / EXTRACTED / OPEN BEAUTY FACTS PRODUCT SOURCES"
      : "CATALOG FALLBACK PRODUCT SOURCES";

  const productRules =
    liveProducts.length > 0
      ? [
          "These URLs were found in this search of the world, including pages extracted from discovered source pages.",
          "productUrl and officialUrl must exactly match URLs from these product sources.",
          "Do not invent URLs. Catalog fallback is not included because live product pages were found.",
        ]
      : [
          "No live web product pages were found in this search.",
          "These catalog URLs are fallback evidence only. They are not products the resident just found on the web.",
          "productUrl and officialUrl must exactly match URLs from these product sources.",
          "Do not invent URLs.",
        ];

  return [
    "WORLD NEWS / DISCOVERY SIGNALS",
    "These are news signals only. They can explain trends or why a product may be interesting.",
    "They are NOT product sources. Never use their URLs or images as productUrl, officialUrl, or productImageUrl.",
    newsBlock || "No news signals.",
    "",
    productHeader,
    ...productRules,
    productBlock || "No product sources.",
  ].join("\n");
}

function extractJsonObject(raw: string): string {
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function buildHunterPrompt(
  input: ProductHunterInput,
  news: WorldSearchResult[],
  products: WorldSearchResult[],
) {
  return [
    "You are a NEWFIND world resident discovering products.",
    "You are NOT a content generator. You are a real resident of the NEWFIND world.",
    "",
    `Resident: ${input.residentName}`,
    `Personality: ${input.personality}`,
    `Interests: ${input.interests.join(", ")}`,
    `Preferred categories: ${input.preferredCategories.join(", ")}`,
    `Expertise: ${(input.expertise ?? []).join(", ") || "none"}`,
    `Values: ${(input.values ?? []).join(", ") || "none"}`,
    `Region: ${input.region || "unknown"}`,
    `Languages: ${(input.languages ?? []).join(", ") || "unknown"}`,
    `Culture: ${input.culture || "unknown"}`,
    `Goals: ${input.goals.join(" / ") || "none"}`,
    input.huntingSpecialty
      ? `Hunting specialty: ${input.huntingSpecialty}`
      : "",
    "Stay strictly in this specialty. Reject off-lane objects even if they have a clean product URL.",
    "",
    "WORLD NEWS IS A DISCOVERY SIGNAL ONLY.",
    "News may explain why a product is interesting, trending, culturally relevant, or newly noticed.",
    "Never use a news article URL as productUrl or officialUrl.",
    "Never use a news image as productImageUrl.",
    "",
    "PRODUCT SOURCES ARE THE ONLY VALID PRODUCT SOURCES.",
    "productUrl must be copied exactly from one of the PRODUCT SOURCE URLs below.",
    "officialUrl must be copied exactly from a PRODUCT SOURCE URL.",
    "Never invent a product, brand, URL, price, or official website.",
    "Never generate an image URL. productImageUrl is filled from the source page later.",
    "Prefer Origin web, extracted, or open_beauty_facts over catalog.",
    "Select a concrete individual product that a person could actually purchase.",
    "Do not select stores, shops, category pages, collection pages, catalogs, search pages, articles, magazines, books, events, or generic landing pages.",
    "A product source URL must represent the specific product itself, not merely a website that sells products.",
    "",
    "Use the resident's expertise, values, culture, interests, and personality as the lens for deciding what is interesting.",
    "attentionReason must be this resident's own reason for noticing the product. Do not write a generic recommendation.",
    "Stay inside this resident's hunting specialty. Do not pick a product just because another resident might like it.",
    "Expertise such as economics should affect how the resident evaluates products, for example price, marketability, brand strategy, or value.",
    "Do not turn the resident into a political-news poster.",
    "",
    "Return at most 3 product candidates. Keep every description and attentionReason under 120 characters.",
    "Only return products supported by PRODUCT SOURCES.",
    "confidenceScore must be 50 or higher.",
    "Return JSON only.",
    "",
    "Allowed categories:",
    "fashion / beauty / accessories / fragrance / japan_brand / celebrity_style / anime_culture / lifestyle / food / travel / home / tech / sports / other",
    "",
    "Allowed trendTags:",
    "celebrity_pick / viral / trending / rising / new_release / best_seller / gen_z_trend / world_trend / japan_trend / us_trend / korea_trend / uk_trend / re_discovered / editorial_pick / hidden_gem / luxury / teen / high_school / y2k / streetwear",
    "",
    "Required JSON shape:",
    '{"products":[{"brand":"brand","productName":"product","category":"fashion","subcategory":"subcategory","country":"country","description":"description","productUrl":"PRODUCT_SOURCE_URL","officialUrl":"PRODUCT_SOURCE_URL_OR_NULL","currency":"USD","price":null,"attentionReason":"why this resident noticed it","trendTags":[],"trendScore":0,"confidenceScore":0}]}',
    "",
    buildSearchContext(news, products),
    "",
    `News signals available: ${news.length}`,
    `Product sources available: ${products.length}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
export async function evaluateProductCandidates(
  input: ProductHunterInput,
): Promise<ProductHunterCandidate[]> {
  const news = input.results.filter(isNewsSignal);
  const allProducts = input.results.filter(isProductSource);
  const trace =
    input.trace ??
    createPipelineTrace({
      actorName: input.residentName,
      actorRole: "product_hunter",
    });
  const strategy = getHunterStrategy(input.hunterUsername);
  const inLane = (result: WorldSearchResult) =>
    resultFitsHunterSpecialty({
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      username: input.hunterUsername,
      huntingSpecialty: input.huntingSpecialty,
      strategy,
    });
  const liveProducts = allProducts.filter(isLiveWorldProduct).filter(inLane);
  const catalogProducts = allProducts
    .filter((result) => result.origin === "catalog")
    .filter(inLane);
  const products = liveProducts.length > 0 ? liveProducts : catalogProducts;
  trace.funnel.productCandidates = allProducts.length;
  trace.funnel.newsCandidates = news.length;
  trace.funnel.liveProducts = liveProducts.length;
  trace.funnel.specialtyPass = products.length;
  markPipelineEvent(trace, "CLASSIFICATION_COMPLETED");

  if (products.length === 0) {
    console.log(
      "PRODUCT HUNTER: no product sources. News-only results cannot become products.",
    );
    if (allProducts.length === 0) {
      recordDrop(trace, { reason: "NOT_PRODUCT", detail: "no product-classified sources" });
    } else {
      recordDrop(trace, {
        reason: "SPECIALTY_MISMATCH",
        detail: "product sources existed but none matched specialty",
      });
    }
    return [];
  }

  console.log(
    "PRODUCT HUNTER: live product sources:",
    liveProducts.length,
    "catalog fallback:",
    catalogProducts.length,
  );

  const productUrlMap = new Map<string, WorldSearchResult>();

  for (const result of products) {
    if (!isValidHttpUrl(result.url)) continue;
    productUrlMap.set(normalizeUrl(result.url), result);
  }

  /*
   * IMPORTANT:
   * The resident evaluates the world, rather than merely selecting URLs.
   *
   * News = discovery/trend signal only.
   * Product sources = the only allowed evidence for concrete products.
   */
  const prompt = buildHunterPrompt(input, news, products);

  console.log("=== AI PRODUCT HUNTER REQUEST ===");
  console.log("resident:", input.residentName);
  console.log("news signals:", news.length);
  console.log("product sources:", products.length);
  console.log("=== END REQUEST ===");

  let raw: string;

  try {
    raw = await generateAIText(prompt);
  } catch (error) {
    console.error("PRODUCT HUNTER AI ERROR:", error);
    recordDrop(trace, { reason: "AI_REJECTED", detail: "hunter model error" });
    return [];
  }

  console.log("=== AI PRODUCT HUNTER RAW RESPONSE ===");
  console.log(raw);
  console.log("=== END RAW RESPONSE ===");

  try {
    const jsonText = extractJsonObject(raw);

    const parsed = JSON.parse(jsonText) as {
      products?: unknown;
    };

    if (!Array.isArray(parsed.products)) {
      console.log("PRODUCT HUNTER: products is not an array");
      recordDrop(trace, { reason: "AI_REJECTED", detail: "products is not an array" });
      return [];
    }

    console.log(
      "PRODUCT HUNTER: AI returned products:",
      parsed.products.length,
    );
    trace.funnel.aiSelected = parsed.products.length;
    markPipelineEvent(trace, "AI_DECISION_COMPLETED");

    const newsUrlSet = new Set<string>();

    for (const result of news) {
      if (!isValidHttpUrl(result.url)) continue;
      newsUrlSet.add(normalizeUrl(result.url));
    }

    const candidates: ProductHunterCandidate[] = [];

    for (const item of parsed.products.slice(0, 3)) {
      if (!item || typeof item !== "object") continue;

      const candidate = item as Record<string, unknown>;

      const productUrl = safeString(candidate.productUrl);

      if (!productUrl || !isValidHttpUrl(productUrl)) {
        console.log("PRODUCT HUNTER: invalid or missing product URL");
        recordDrop(trace, { reason: "AI_REJECTED", detail: "invalid product URL" });
        continue;
      }

      const normalizedProductUrl = normalizeUrl(productUrl);

      /*
       * Never allow the model to invent or modify URLs.
       * The URL must exist in the original world-search product sources.
       */
      if (newsUrlSet.has(normalizedProductUrl)) {
        console.log(
          "PRODUCT HUNTER: rejected news URL:",
          productUrl,
        );
        recordDrop(trace, { url: productUrl, reason: "NOT_PRODUCT", detail: "news URL" });
        continue;
      }

      const source = productUrlMap.get(normalizedProductUrl);

      if (!source) {
        console.log(
          "PRODUCT HUNTER: rejected URL not present in PRODUCT SOURCES:",
          productUrl,
        );
        recordDrop(trace, {
          url: productUrl,
          reason: "AI_REJECTED",
          detail: "URL not in product sources",
        });
        continue;
      }

      /*
       * Validate the concrete product using both the model output
       * and the original source evidence.
       */
      if (!isLikelyConcreteProduct(candidate, source)) {
        console.log(
          "PRODUCT HUNTER: rejected non-concrete product:",
          productUrl,
        );
        recordDrop(trace, {
          url: productUrl,
          reason: "NOT_PRODUCT",
          detail: "not a concrete product page",
        });
        continue;
      }

      const brand =
        safeString(candidate.brand) ||
        source.title.split(" - ")[0]?.trim() ||
        source.domain ||
        "Unknown";

      const productName =
        safeString(candidate.productName) ||
        source.title.split(" - ").slice(1).join(" - ").trim() ||
        source.title.trim();

      if (!brand || !productName) {
        console.log(
          "PRODUCT HUNTER: rejected candidate without brand/product name:",
          productUrl,
        );
        continue;
      }

      const category = safeCategory(candidate.category);

      const subcategory = safeString(candidate.subcategory).slice(0, 100);

      const country =
        safeString(candidate.country) ||
        source.sourceCountry ||
        null;

      const requestedDescription = safeString(candidate.description).slice(0, 500);

      /*
       * officialUrl must also come from an actual product source.
       * Never trust an invented URL from the model.
       */
      let officialUrl: string | null = null;

      const requestedOfficialUrl = safeString(candidate.officialUrl);

      if (requestedOfficialUrl) {
        const normalizedOfficialUrl = normalizeUrl(requestedOfficialUrl);
        const officialSource = productUrlMap.get(normalizedOfficialUrl);

        if (officialSource) {
          officialUrl = officialSource.url;
        } else {
          console.log(
            "PRODUCT HUNTER: rejected invented official URL:",
            requestedOfficialUrl,
          );
        }
      }

      if (!officialUrl && source.sourceType === "brand_official") {
        officialUrl = source.url;
      }

      /*
       * Investigate the live product page. Search snippets are not
       * enough to post; facts must come from the page itself.
       */
      let productImageUrl: string | null = null;
      let sku: string | null = null;
      let gtin: string | null = null;
      let modelNumber: string | null = null;
      let launchDate: string | null = null;
      let pageDescription = "";
      let pagePrice = safePrice(candidate.price);
      let pageCurrency =
        safeString(candidate.currency).toUpperCase().slice(0, 10) || "USD";
      const evidence: string[] = [`search:${source.origin ?? "web"}`];

      if (source.origin === "catalog") {
        productImageUrl = isUsableProductImage(source.imageUrl)
          ? source.imageUrl ?? null
          : null;
        evidence.push("catalog");
        if (!isAcceptableProductPageImage(productImageUrl)) {
          console.log(
            "PRODUCT HUNTER: catalog fallback without usable image skipped:",
            source.url,
          );
          recordDrop(trace, {
            url: source.url,
            reason: "NO_PRODUCT_IMAGE",
            detail: "catalog",
          });
          continue;
        }
      } else if (source.sourceRole !== "news") {
        try {
          const productPageHtml = await fetchPageHtml(source.url);

          if (productPageHtml) {
            const facts = extractProductFactsFromHtml(
              productPageHtml,
              source.url,
            );
            productImageUrl =
              extractProductImageFromHtml(productPageHtml, source.url) ||
              facts.imageUrl;
            sku = facts.sku;
            gtin = facts.gtin;
            modelNumber = facts.modelNumber;
            launchDate = facts.launchDate;
            if (facts.price != null) pagePrice = facts.price;
            if (facts.currency) pageCurrency = facts.currency.toUpperCase();
            if (facts.description) {
              pageDescription = facts.description.slice(0, 500);
            }
            if (facts.officialUrl && !officialUrl) {
              officialUrl = facts.officialUrl;
            }
            if (!productFactsAreSufficient(facts) && !productImageUrl) {
              console.log(
                "PRODUCT HUNTER: rejected product with thin page evidence:",
                source.url,
              );
              recordDrop(trace, {
                url: source.url,
                reason: "LOW_EVIDENCE",
                detail: "thin page evidence",
              });
              continue;
            }
            if (facts.sku || facts.gtin || facts.modelNumber) {
              evidence.push("identity");
            }
            if (facts.price != null) evidence.push("price");
            if (facts.launchDate) evidence.push("launch");
            evidence.push("product-page");
          }
        } catch (error) {
          console.error(
            "PRODUCT HUNTER: product page investigation failed:",
            source.url,
            error,
          );
        }

        if (!isAcceptableProductPageImage(productImageUrl)) {
          console.log(
            "PRODUCT HUNTER: rejected product without canonical product image:",
            productUrl,
          );
          recordDrop(trace, {
            url: productUrl,
            reason: "NO_PRODUCT_IMAGE",
          });
          continue;
        }
      }

      const description =
        pageDescription ||
        (requestedDescription && requestedDescription !== source.snippet.slice(0, 500)
          ? requestedDescription
          : "");
      if (!description) {
        console.log(
          "PRODUCT HUNTER: rejected snippet-only description:",
          productUrl,
        );
        recordDrop(trace, {
          url: productUrl,
          reason: "NO_PRODUCT_DESCRIPTION",
        });
        continue;
      }

      const currency = pageCurrency;
      const price = pagePrice;

      const attentionReason =
        safeString(candidate.attentionReason).slice(0, 200) ||
        `${input.residentName} noticed this product.`;

      const trendTags = safeTrendTags(candidate.trendTags);
      const trendScore = safeScore(candidate.trendScore);
      const confidenceScore = safeScore(candidate.confidenceScore);

      if (confidenceScore < 50) {
        console.log(
          "PRODUCT HUNTER: rejected low-confidence candidate:",
          productName,
          confidenceScore,
        );
        recordDrop(trace, {
          url: source.url,
          title: productName,
          reason: "LOW_CONFIDENCE",
          detail: String(confidenceScore),
        });
        continue;
      }

      const fitScore = specialtyFitScore({
        brand,
        productName,
        url: source.url,
        description,
        username: input.hunterUsername,
        huntingSpecialty: input.huntingSpecialty,
        strategy,
      });
      if (fitScore < 50) {
        console.log(
          "PRODUCT HUNTER: rejected off-specialty candidate:",
          productName,
          source.url,
          fitScore,
        );
        recordDrop(trace, {
          url: source.url,
          title: productName,
          reason: "SPECIALTY_MISMATCH",
          detail: String(fitScore),
        });
        continue;
      }

      const preferredDomains = preferredSearchDomains(strategy);
      const reliability = sourceReliabilityLabel({
        sourceType: source.sourceType,
        sourceRole: source.sourceRole,
        hasOfficialUrl: Boolean(officialUrl),
        hasPageEvidence: evidence.includes("product-page"),
        hasPressPath: /\/press/i.test(source.url),
      });
      if (isWeakReliability(reliability) && !evidence.includes("product-page")) {
        recordDrop(trace, {
          url: source.url,
          title: productName,
          reason: "LOW_EVIDENCE",
          detail: reliability,
        });
        continue;
      }
      const report = emptyDiscoveryReport({
        brand,
        productName,
        category,
        subcategory,
        country,
        productUrl: source.url,
        officialUrl,
        productImageUrl,
        price,
        currency,
        launchDate,
        sku,
        gtin,
        modelNumber,
        canonicalUrl: canonicalProductUrl(officialUrl || source.url),
        sourceUrls: [source.url, officialUrl].filter(Boolean) as string[],
        evidence,
        whyNow: attentionReason,
        whyThisResident: attentionReason,
        trendSignals: trendTags,
        noveltyScore: trendScore,
        residentFitScore: fitScore,
        humanInterestScore: Math.min(100, trendScore + (price != null ? 10 : 0)),
        duplicateRisk: 0,
        confidenceScore,
        sourceReliability: reliability,
        evidenceSummary: evidence.join(", "),
        decision: "SAVE",
      });
      report.evidenceScore = scoreDiscoveryEvidence(report, {
        marketplace:
          isMarketplaceProductUrl(source.url) && strategy?.brandSize === "indie",
        preferredSource: preferredDomains.some((domain) =>
          source.domain.includes(domain),
        ),
      });
      report.confidenceScore = Math.min(confidenceScore, report.evidenceScore + 20);

      if (report.evidenceScore < 55) {
        console.log(
          "PRODUCT HUNTER: rejected low-evidence report:",
          productName,
          report.evidenceScore,
        );
        recordDrop(trace, {
          url: source.url,
          title: productName,
          reason: "LOW_EVIDENCE",
          detail: String(report.evidenceScore),
        });
        continue;
      }

      trace.funnel.qualityPass += 1;

      candidates.push({
        brand,
        productName,
        category,
        subcategory,
        country,
        description,
        productUrl: source.url,
        officialUrl,
        productImageUrl,
        currency,
        price,
        sku,
        gtin,
        modelNumber,
        launchDate,
        attentionReason,
        trendTags,
        trendScore,
        confidenceScore: report.confidenceScore,
        origin: source.origin ?? "web",
        report,
      });
    }

    /*
     * Final URL-level deduplication.
     */
    const unique = new Map<string, ProductHunterCandidate>();

    for (const candidate of candidates) {
      const key = normalizeUrl(candidate.productUrl);

      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    }

    const finalCandidates = [...unique.values()].slice(0, 3);
    trace.funnel.aiSelected = finalCandidates.length;
    markPipelineEvent(trace, "QUALITY_CHECK_COMPLETED");

    console.log(
      "PRODUCT HUNTER: final candidates:",
      finalCandidates.length,
    );

    for (const candidate of finalCandidates) {
      console.log("PRODUCT HUNTER: candidate:", {
        resident: input.residentName,
        brand: candidate.brand,
        productName: candidate.productName,
        category: candidate.category,
        productUrl: candidate.productUrl,
        officialUrl: candidate.officialUrl,
        origin: candidate.origin,
        productImageUrl: candidate.productImageUrl,
        price: candidate.price,
        currency: candidate.currency,
        trendTags: candidate.trendTags,
        trendScore: candidate.trendScore,
        confidenceScore: candidate.confidenceScore,
        attentionReason: candidate.attentionReason,
      });
    }

    return finalCandidates;
  } catch (error) {
    console.error("PRODUCT HUNTER JSON PARSE ERROR:", error);
    console.error("RAW RESPONSE:", raw);
    recordDrop(trace, { reason: "AI_REJECTED", detail: "json parse error" });
    return [];
  }
}
