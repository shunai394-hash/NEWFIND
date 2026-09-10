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
  const label = kind === "news" ? "ニュースシグナル" : "商品ソース";
  return [
    `${label} ${index + 1}`,
    `タイトル: ${result.title}`,
    `URL: ${result.url}`,
    `ドメイン: ${result.domain}`,
    `種類: ${result.sourceType}`,
    `役割: ${result.sourceRole ?? (kind === "news" ? "news" : "product")}`,
    result.language ? `言語: ${result.language}` : "",
    result.sourceCountry ? `発信国: ${result.sourceCountry}` : "",
    result.publishedAt ? `公開: ${result.publishedAt}` : "",
    kind === "news" && result.imageUrl
      ? "画像: ニュース画像あり（商品画像ではない）"
      : "",
    `概要: ${result.snippet.slice(0, 600)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSearchContext(
  news: WorldSearchResult[],
  products: WorldSearchResult[],
): string {
  const newsBlock = news
    .slice(0, 12)
    .map((result, index) => formatSearchRow(result, index, "news"))
    .join("\n\n");

  const productBlock = products
    .slice(0, 12)
    .map((result, index) => formatSearchRow(result, index, "product"))
    .join("\n\n");

  return [
    "【世界ニュース / 発見シグナル】",
    "これらはGDELTのニュースです。商品ページではありません。",
    "きっかけとして読んでください。URLをproductUrlに使ってはいけません。",
    newsBlock || "ニュースシグナルはありません。",
    "",
    "【商品ソース】",
    "これらはCatalog / Tavilyの検索結果です。",
    "productUrl と officialUrl は、この商品ソースのURLだけを使ってください。",
    productBlock || "商品ソースはありません。",
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
    "あなたはNEWFIND世界のAI住民です。",
    "あなたは「AIコンテンツ生成機能」ではなく、世界に住む一人の住民です。",
    "",
    `あなたの名前: ${input.residentName}`,
    `あなたの性格: ${input.personality}`,
    `あなたの興味: ${input.interests.join(", ")}`,
    `あなたが好きなカテゴリー: ${input.preferredCategories.join(", ")}`,
    `あなたの専門性: ${(input.expertise ?? []).join(", ") || "なし"}`,
    `あなたの価値観: ${(input.values ?? []).join(", ") || "なし"}`,
    `あなたの国・地域: ${input.region || "不明"}`,
    `あなたの言語: ${(input.languages ?? []).join(", ") || "不明"}`,
    `あなたの文化: ${input.culture || "不明"}`,
    `あなたの目標: ${input.goals.join(" / ") || "なし"}`,
    "",
    "世界で見つかったニュースや商品を見て、",
    "「自分なら何に興味を持つか」という視点で商品を発見してください。",
    "",
    "重要ルール:",
    "1. 実在する商品だけを選ぶ。",
    "2. 存在しないブランド・商品を作らない。",
    "3. URLを作らない。",
    "4. productUrlは商品ソースとして渡された検索結果のURLだけを使用する。",
    "5. GDELTのニュースURLをproductUrlにしてはいけない。",
    "6. GDELTニュースは商品発見のきっかけとして使う。",
    "7. 商品URLが確認できない場合、そのニュースだけから商品を登録しない。",
    "8. officialUrlも検索結果に存在するURLだけを使用する。",
    "9. 一般ニュース・企業ニュースだけの場合は商品候補にしない。",
    "10. confidenceScoreが50未満の商品は除外。",
    "11. 最大5商品。",
    "12. 同じ商品は重複させない。",
    "13. attentionReasonには「なぜこのAI住民がその商品に注目したか」を書く。",
    "14. expertiseは政治的投稿能力ではなく、商品を見るレンズとして使用する。",
    "15. ニュース画像が商品画像であると断定しない。",
    "16. GDELT socialimageをproductImageUrlとして直接使用しない。",
    "",
    "カテゴリー:",
    "fashion / beauty / accessories / fragrance / japan_brand / celebrity_style / anime_culture / lifestyle / food / travel / home / tech / sports / other",
    "",
    "trendTags:",
    "celebrity_pick / viral / trending / rising / new_release / best_seller / gen_z_trend / world_trend / japan_trend / us_trend / korea_trend / uk_trend / re_discovered / editorial_pick / hidden_gem / luxury / teen / high_school / y2k / streetwear",
    "",
    "必ずJSONだけを返してください。",
    "Markdownの```json```は使用しないでください。",
    "",
    '{"products":[{"brand":"ブランド名","productName":"商品名","category":"fashion","subcategory":"subcategory","country":"国またはnull","description":"商品の説明","productUrl":"商品ソースに存在するURL","officialUrl":"商品ソースに存在する公式URLまたはnull","currency":"USD","price":null,"attentionReason":"このAI住民が注目した理由","trendTags":[],"trendScore":0,"confidenceScore":0}]}',
    "",
    buildSearchContext(news, products),
    "",
    `ニュースシグナル件数: ${news.length}`,
    `商品ソース件数: ${products.length}`,
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

  const prompt = buildHunterPrompt(input, news, products);
  const newsImages = news
    .filter((item) => item.imageUrl)
    .map((item) => ({
      url: item.imageUrl as string,
      label: item.title,
    }));

  console.log("=== AI PRODUCT HUNTER REQUEST ===");
  console.log("resident:", input.residentName);
  console.log("news signals:", news.length);
  console.log("product sources:", products.length);
  console.log("news images for vision:", newsImages.length);
  console.log("=== END REQUEST ===");

  const raw =
    newsImages.length > 0
      ? await generateAITextWithImages(prompt, newsImages)
      : await generateAIText(prompt);

  console.log("=== AI PRODUCT HUNTER RAW RESPONSE ===");
  console.log(raw);
  console.log("=== END RAW RESPONSE ===");

  try {
    const jsonText = extractJsonObject(raw);

    console.log("=== AI PRODUCT HUNTER JSON TEXT ===");
    console.log(jsonText);
    console.log("=== END JSON TEXT ===");

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

    const productUrlMap = new Map<string, WorldSearchResult>();
    const newsUrlSet = new Set<string>();

    for (const result of products) {
      if (!isValidHttpUrl(result.url)) continue;
      productUrlMap.set(normalizeUrl(result.url), result);
    }

    for (const result of news) {
      if (!isValidHttpUrl(result.url)) continue;
      newsUrlSet.add(normalizeUrl(result.url));
    }

    const candidates: ProductHunterCandidate[] = [];

    for (const item of parsed.products) {
      if (!item || typeof item !== "object") continue;

      const candidate = item as Record<string, unknown>;
      const brand = safeString(candidate.brand);
      const productName = safeString(candidate.productName);
      const productUrl = safeString(candidate.productUrl);

      if (!brand || !productName || !productUrl) {
        console.log("PRODUCT HUNTER: missing required fields");
        continue;
      }

      if (!isValidHttpUrl(productUrl)) {
        console.log("PRODUCT HUNTER: invalid product URL:", productUrl);
        continue;
      }

      const normalized = normalizeUrl(productUrl);

      if (newsUrlSet.has(normalized)) {
        console.log(
          "PRODUCT HUNTER: rejected GDELT news URL as productUrl:",
          productUrl,
        );
        continue;
      }

      const source = productUrlMap.get(normalized);
      if (!source) {
        console.log(
          "PRODUCT HUNTER: URL not found in product sources:",
          productUrl,
        );
        continue;
      }

      const officialUrlCandidate = safeString(candidate.officialUrl);
      let officialUrl: string | null = null;

      if (
        officialUrlCandidate &&
        isValidHttpUrl(officialUrlCandidate) &&
        !newsUrlSet.has(normalizeUrl(officialUrlCandidate))
      ) {
        const officialSource = productUrlMap.get(
          normalizeUrl(officialUrlCandidate),
        );
        officialUrl = officialSource?.url ?? null;
      } else if (
        officialUrlCandidate &&
        newsUrlSet.has(normalizeUrl(officialUrlCandidate))
      ) {
        console.log(
          "PRODUCT HUNTER: ignored GDELT news URL as officialUrl:",
          officialUrlCandidate,
        );
      }

      if (!officialUrl && source.sourceType === "brand_official") {
        officialUrl = source.url;
      }

      const confidenceScore = safeScore(candidate.confidenceScore);
      if (confidenceScore < 50) {
        console.log(
          "PRODUCT HUNTER: confidence too low:",
          confidenceScore,
          brand,
          productName,
        );
        continue;
      }

      const productImageUrl =
        source.sourceRole !== "news" &&
        isUsableProductImage(source.imageUrl)
          ? source.imageUrl ?? null
          : null;

      candidates.push({
        brand,
        productName,
        category: safeCategory(candidate.category),
        subcategory: safeString(candidate.subcategory),
        country: safeString(candidate.country) || null,
        description: safeString(candidate.description),
        productUrl: source.url,
        officialUrl,
        productImageUrl,
        currency: safeString(candidate.currency) || "USD",
        price: safePrice(candidate.price),
        attentionReason: safeString(candidate.attentionReason),
        trendTags: safeTrendTags(candidate.trendTags),
        trendScore: safeScore(candidate.trendScore),
        confidenceScore,
      });
    }

    const unique = new Map<string, ProductHunterCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.brand}::${candidate.productName}`
        .toLowerCase()
        .trim();
      if (!unique.has(key)) unique.set(key, candidate);
    }

    const finalCandidates = [...unique.values()].slice(0, 5);
    console.log("PRODUCT HUNTER: final candidates:", finalCandidates.length);
    return finalCandidates;
  } catch (error) {
    console.error("PRODUCT HUNTER JSON PARSE ERROR:", error);
    console.error("RAW RESPONSE:", raw);
    return [];
  }
}
