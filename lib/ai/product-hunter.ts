import { generateAIText } from "./groq";
import type { WorldSearchResult } from "./world-search";
import type { DiscoveryCategory, TrendTag } from "@/lib/discovery/types";

export type ProductHunterInput = {
  residentId: string;
  residentName: string;
  personality: string;
  interests: string[];
  preferredCategories: string[];
  goals: string[];
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
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const price = Number(value);

  return Number.isFinite(price) ? price : null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
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

function buildSearchContext(
  results: WorldSearchResult[],
): string {
  const limitedResults = results.slice(0, 10);

  return limitedResults
    .map(
      (result, index) =>
        [
          `検索結果 ${index + 1}`,
          `タイトル: ${result.title}`,
          `URL: ${result.url}`,
          `ドメイン: ${result.domain}`,
          `種類: ${result.sourceType}`,
          `概要: ${result.snippet.slice(0, 600)}`,
        ].join("\n"),
    )
    .join("\n\n");
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

export async function evaluateProductCandidates(
  input: ProductHunterInput,
): Promise<ProductHunterCandidate[]> {
  if (input.results.length === 0) {
    return [];
  }

  const context = buildSearchContext(input.results);

  const prompt = [
    "あなたはNEWFINDのAI商品ハンターです。",
    "",
    `あなたの名前: ${input.residentName}`,
    `あなたの性格: ${input.personality}`,
    `あなたの興味: ${input.interests.join(", ")}`,
    `あなたが重視するカテゴリー: ${input.preferredCategories.join(", ")}`,
    `あなたの目的: ${input.goals.join(" / ")}`,
    "",
    "以下はあなたがNEWFINDの世界で発見したWeb検索結果です。",
    "この中から、あなた自身が興味を持ち、NEWFINDで紹介候補にする価値がある実在商品だけを選んでください。",
    "",
    "重要ルール:",
    "1. 検索結果に実際に存在する商品だけを選ぶ。",
    "2. 存在しない商品名、ブランド、URLを作らない。",
    "3. productUrlには検索結果に実際に存在するURLだけを使用する。",
    "4. officialUrlを指定する場合も、検索結果に実際に存在するURLだけを使用する。",
    "5. URLを推測したり生成したりしない。",
    "6. 商品だと判断できない記事や一般情報は候補にしない。",
    "7. 確信度が低い商品は候補から除外する。",
    "8. 同じ商品が複数結果にある場合は1件にまとめる。",
    "9. 最大5商品まで。",
    "10. trendScoreはトレンド性だけを評価する。",
    "11. confidenceScoreは商品情報とURLの確実性を評価する。",
    "12. attentionReasonには、このAI住民自身がなぜ注目したのかを書く。",
    "13. AI住民の性格・興味・目的を評価に反映する。",
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
    '{"products":[{"brand":"ブランド名","productName":"商品名","category":"fashion","subcategory":"subcategory","country":"国またはnull","description":"商品の説明","productUrl":"検索結果に存在するURL","officialUrl":"検索結果に存在する公式URLまたはnull","currency":"USD","price":null,"attentionReason":"このAIが注目した理由","trendTags":[],"trendScore":0,"confidenceScore":0}]}',
    "",
    "検索結果:",
    context,
  ].join("\n");

  console.log("=== AI PRODUCT HUNTER REQUEST ===");
  console.log("resident:", input.residentName);
  console.log("results:", input.results.length);
  console.log("=== END REQUEST ===");

  const raw = await generateAIText(prompt);

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
      console.log(
        "PRODUCT HUNTER: products is not an array",
      );

      return [];
    }

    console.log(
      "PRODUCT HUNTER: AI returned products:",
      parsed.products.length,
    );

    const sourceUrlMap = new Map<string, WorldSearchResult>();

    for (const result of input.results) {
      if (!isValidHttpUrl(result.url)) continue;

      sourceUrlMap.set(
        normalizeUrl(result.url),
        result,
      );
    }

    const candidates: ProductHunterCandidate[] = [];

    for (const item of parsed.products) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const candidate = item as Record<string, unknown>;

      const brand = safeString(candidate.brand);
      const productName = safeString(candidate.productName);
      const productUrl = safeString(candidate.productUrl);

      if (!brand || !productName || !productUrl) {
        console.log(
          "PRODUCT HUNTER: missing required fields",
        );

        continue;
      }

      if (!isValidHttpUrl(productUrl)) {
        console.log(
          "PRODUCT HUNTER: invalid product URL:",
          productUrl,
        );

        continue;
      }

      const source = sourceUrlMap.get(
        normalizeUrl(productUrl),
      );

      if (!source) {
        console.log(
          "PRODUCT HUNTER: URL not found in search results:",
          productUrl,
        );

        continue;
      }

      const officialUrlCandidate = safeString(
        candidate.officialUrl,
      );

      if (
        officialUrlCandidate &&
        !isValidHttpUrl(officialUrlCandidate)
      ) {
        console.log(
          "PRODUCT HUNTER: invalid official URL:",
          officialUrlCandidate,
        );

        continue;
      }

      const officialSource =
        officialUrlCandidate
          ? sourceUrlMap.get(
              normalizeUrl(officialUrlCandidate),
            )
          : null;

      if (
        officialUrlCandidate &&
        !officialSource
      ) {
        console.log(
          "PRODUCT HUNTER: official URL not found in search results:",
          officialUrlCandidate,
        );

        continue;
      }

      const officialUrl =
        officialSource?.url ??
        (source?.sourceType === "brand_official"
          ? source.url
          : null);

      const confidenceScore = safeScore(
        candidate.confidenceScore,
      );

      if (confidenceScore < 50) {
        console.log(
          "PRODUCT HUNTER: confidence too low:",
          confidenceScore,
          brand,
          productName,
        );

        continue;
      }

      const normalizedCandidateUrl =
        normalizeUrl(productUrl);

      const canonicalSourceUrl = source
        ? source.url
        : normalizedCandidateUrl;

      candidates.push({
        brand,
        productName,
        category: safeCategory(
          candidate.category,
        ),
        subcategory: safeString(
          candidate.subcategory,
        ),
        country:
          safeString(candidate.country) || null,
        description: safeString(
          candidate.description,
        ),
        productUrl: canonicalSourceUrl,
        officialUrl,
        currency:
          safeString(candidate.currency) || "USD",
        price: safePrice(candidate.price),
        attentionReason: safeString(
          candidate.attentionReason,
        ),
        trendTags: safeTrendTags(
          candidate.trendTags,
        ),
        trendScore: safeScore(
          candidate.trendScore,
        ),
        confidenceScore,
      });
    }

    const unique =
      new Map<string, ProductHunterCandidate>();

    for (const candidate of candidates) {
      const key =
        `${candidate.brand}::${candidate.productName}`
          .toLowerCase()
          .trim();

      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    }

    const finalCandidates = [
      ...unique.values(),
    ].slice(0, 5);

    console.log(
      "PRODUCT HUNTER: final candidates:",
      finalCandidates.length,
    );

    return finalCandidates;
  } catch (error) {
    console.error(
      "PRODUCT HUNTER JSON PARSE ERROR:",
      error,
    );

    console.error(
      "RAW RESPONSE:",
      raw,
    );

    return [];
  }
}