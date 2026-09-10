import { isUsableProductImage } from "@/lib/discovery/media";
import { generateAIText, generateAITextWithImages } from "./groq";
import {
  isNewsSignal,
  isProductSource,
  type WorldSearchResult,
} from "./world-search";
import type { DiscoveryCategory, TrendTag } from "@/lib/discovery/types";

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
  results: WorldSearchResult[];
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
  attentionReason: string;
  trendTags: TrendTag[];
  trendScore: number;
  confidenceScore: number;
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

  const genericPagePatterns = [
    "shop",
    "store",
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
    "店舗",
    "ショップ",
    "ストア",
    "カテゴリ",
    "カテゴリー",
    "コレクション",
    "商品一覧",
    "一覧",
    "検索",
    "記事",
    "ニュース",
    "雑誌",
    "イベント",
  ];

  const genericPageText = `${productName} ${title}`.trim();

  if (genericPagePatterns.some((pattern) => genericPageText.includes(pattern))) {
    console.log(
      "PRODUCT HUNTER: rejected generic/non-product page:",
      productName,
      source.url,
    );
    return false;
  }

  const nonTargetContentPatterns = [
    "hardcover book",
    "paperback book",
    "ebook",
    "kindle",
    "magazine issue",
    "書籍",
    "本",
    "小説",
    "雑誌",
    "電子書籍",
  ];

  if (
    nonTargetContentPatterns.some(
      (pattern) =>
        description.includes(pattern) ||
        title.includes(pattern) ||
        snippet.includes(pattern),
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
    /add to cart|add to bag|buy now|shop now|price|sku|ingredients|volume|ml|oz|size|color|colour|購入|価格|容量|成分|サイズ|カラー|商品/u.test(
      productEvidence,
    );

  const hasProductPath =
    /\/products?(?:\/|$)|\/items?(?:\/|$)|\/shop\/[^/?#]+|\/store\/[^/?#]+|\/p\/[^/?#]+|\/dp\/[a-z0-9]+/u.test(
      url,
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
  const newsBlock = news
    .slice(0, 8)
    .map((result, index) => formatSearchRow(result, index, "news"))
    .join("\n\n");

  const productBlock = products
    .slice(0, 8)
    .map((result, index) => formatSearchRow(result, index, "product"))
    .join("\n\n");

  return [
    "WORLD NEWS / DISCOVERY SIGNALS",
    "These are news signals only. They can explain trends or why a product may be interesting.",
    "They are NOT product sources. Never use their URLs or images as productUrl, officialUrl, or productImageUrl.",
    newsBlock || "No news signals.",
    "",
    "PRODUCT SOURCES",
    "These are the only sources that may provide product URLs and official URLs.",
    "productUrl and officialUrl must exactly match URLs from these product sources.",
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
    "Select a concrete individual product that a person could actually purchase.",
    "Do not select stores, shops, category pages, collection pages, catalogs, search pages, articles, magazines, books, events, or generic landing pages.",
    "A product source URL must represent the specific product itself, not merely a website that sells products.",
    "",
    "Use the resident's expertise, values, culture, interests, and personality as the lens for deciding what is interesting.",
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
  const products = input.results.filter(isProductSource);

  if (products.length === 0) {
    console.log(
      "PRODUCT HUNTER: no product sources. News-only results cannot become products.",
    );
    return [];
  }

  const productUrlMap = new Map<string, WorldSearchResult>();

  for (const result of products) {
    if (!isValidHttpUrl(result.url)) continue;
    productUrlMap.set(normalizeUrl(result.url), result);
  }

  const productBlock = products
    .slice(0, 12)
    .map(
      (result, index) =>
        `PRODUCT ${index + 1}\nTitle: ${result.title}\nURL: ${result.url}\nDomain: ${result.domain}\nSnippet: ${result.snippet.slice(0, 220)}`,
    )
    .join("\n\n");

  const prompt = [
    "You are a NEWFIND world resident discovering products.",
    "Choose products that this resident would genuinely notice.",
    "",
    `Resident: ${input.residentName}`,
    `Personality: ${input.personality}`,
    `Interests: ${input.interests.join(", ")}`,
    `Preferred categories: ${input.preferredCategories.join(", ")}`,
    `Expertise: ${(input.expertise ?? []).join(", ") || "none"}`,
    `Values: ${(input.values ?? []).join(", ") || "none"}`,
    `Region: ${input.region || "unknown"}`,
    `Culture: ${input.culture || "unknown"}`,
    `Goals: ${input.goals.join(" / ") || "none"}`,
    "",
    "IMPORTANT RULES:",
    "You may ONLY select URLs copied exactly from the PRODUCT SOURCES below.",
    "Never invent a URL.",
    "Never modify a URL.",
    "Never select a news URL.",
    "Never select books, magazines, articles, stores, shops, categories, collections, catalogs, search pages, events, or generic landing pages.",
    "Select at most 3 concrete individual purchasable products.",
    "If no suitable product exists, return an empty products array.",
    "",
    "Return JSON ONLY in this exact minimal format:",
    '{"products":[{"productUrl":"EXACT_URL_FROM_SOURCE"}]}',
    "",
    "PRODUCT SOURCES:",
    productBlock,
  ].join("\n");

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
      return [];
    }

    console.log(
      "PRODUCT HUNTER: AI returned products:",
      parsed.products.length,
    );

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
        continue;
      }

      const normalized = normalizeUrl(productUrl);

      if (newsUrlSet.has(normalized)) {
        console.log(
          "PRODUCT HUNTER: rejected news URL:",
          productUrl,
        );
        continue;
      }

      const source = productUrlMap.get(normalized);

      if (!source) {
        console.log(
          "PRODUCT HUNTER: rejected URL not present in PRODUCT SOURCES:",
          productUrl,
        );
        continue;
      }

      const sourceCandidate: Record<string, unknown> = {
        brand: source.title,
        productName: source.title,
        description: source.snippet,
      };

      if (!isLikelyConcreteProduct(sourceCandidate, source)) {
        continue;
      }

      const brand =
        source.title.split(" - ")[0]?.trim() ||
        source.domain ||
        "Unknown";

      const productName =
        source.title.split(" - ").slice(1).join(" - ").trim() ||
        source.title.trim();

      if (!productName) continue;

      const productImageUrl =
        source.sourceRole !== "news" &&
        isUsableProductImage(source.imageUrl)
          ? source.imageUrl ?? null
          : null;

      candidates.push({
        brand,
        productName,
        category: "other",
        subcategory: "",
        country: source.sourceCountry ?? null,
        description: source.snippet.slice(0, 500),
        productUrl: source.url,
        officialUrl:
          source.sourceType === "brand_official" ? source.url : null,
        productImageUrl,
        currency: "USD",
        price: null,
        attentionReason: `Discovered by ${input.residentName}.`,
        trendTags: [],
        trendScore: 0,
        confidenceScore: 60,
      });
    }

    const unique = new Map<string, ProductHunterCandidate>();

    for (const candidate of candidates) {
      const key = normalizeUrl(candidate.productUrl);

      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    }

    const finalCandidates = [...unique.values()].slice(0, 3);

    console.log(
      "PRODUCT HUNTER: final candidates:",
      finalCandidates.length,
    );

    return finalCandidates;
  } catch (error) {
    console.error("PRODUCT HUNTER JSON PARSE ERROR:", error);
    console.error("RAW RESPONSE:", raw);
    return [];
  }
}
