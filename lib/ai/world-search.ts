import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
import {
  extractProductImageFromHtml,
  extractUrlsFromText,
  fetchPageHtml,
  isAcceptableProductPageImage,
  isAssetOrNonProductUrl,
  isStoreOrBrandHomepage,
  titleFromProductUrl,
} from "./product-page";
import {
  isBeautyWorldSearchQuery,
  OpenBeautyFactsWorldSearchProvider,
} from "./open-beauty-facts";
import { repairMojibake } from "./text-encoding";

export type WorldSearchQuery = {
  residentId: string;
  residentName: string;
  interests: string[];
  preferredCategories: string[];
  goals: string[];
  query: string;
  country?: string | null;
  language?: string;
  favoriteBrands?: string[];
  expertise?: string[];
  values?: string[];
  region?: string | null;
  discoveryKeywords?: string[];
  huntingSpecialty?: string;
};

export type WorldSearchSourceRole = "product" | "news" | "general";

export type WorldSearchOrigin =
  | "web"
  | "extracted"
  | "catalog"
  | "open_beauty_facts";

export type WorldSearchResult = {
  title: string;
  url: string;
  snippet: string;
  sourceType:
    | "brand_official"
    | "retailer"
    | "official_person"
    | "magazine"
    | "news"
    | "editorial"
    | "sns"
    | "blog"
    | "other";
  domain: string;
  imageUrl?: string | null;
  language?: string | null;
  sourceCountry?: string | null;
  publishedAt?: string | null;
  sourceRole?: WorldSearchSourceRole;
  origin?: WorldSearchOrigin;
  rawContent?: string | null;
};

export interface WorldSearchProvider {
  search(
    query: WorldSearchQuery,
  ): Promise<WorldSearchResult[]>;
}

export function isNewsSignal(result: WorldSearchResult) {
  return result.sourceRole === "news";
}

export function isProductSource(result: WorldSearchResult) {
  return result.sourceRole === "product";
}

export function isLiveWorldProduct(result: WorldSearchResult) {
  return (
    result.sourceRole === "product" &&
    result.origin !== "catalog"
  );
}

/* =========================================================
 * Helpers
 * ======================================================= */

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function getPath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function sourceTypeFromDomain(
  domain: string,
): WorldSearchResult["sourceType"] {
  const d = domain.toLowerCase();

  if (
    d.includes("instagram.com") ||
    d.includes("tiktok.com") ||
    d.includes("youtube.com") ||
    d.includes("x.com") ||
    d.includes("twitter.com") ||
    d.includes("facebook.com") ||
    d.includes("pinterest.com")
  ) {
    return "sns";
  }

  if (
    d.includes("reuters.com") ||
    d.includes("apnews.com") ||
    d.includes("bbc.com") ||
    d.includes("cnn.com") ||
    d.includes("forbes.com") ||
    d.includes("businessinsider.com") ||
    d.includes("theguardian.com") ||
    d.includes("livemint.com")
  ) {
    return "news";
  }

  if (
    d.includes("vogue.com") ||
    d.includes("elle.com") ||
    d.includes("gq.com") ||
    d.includes("wwd.com") ||
    d.includes("cosmopolitan.com") ||
    d.includes("nytimes.com") ||
    d.includes("fashionista.com") ||
    d.includes("hypebeast.com") ||
    d.includes("highsnobiety.com")
  ) {
    return "magazine";
  }

  if (
    d.includes("amazon.") ||
    d.includes("etsy.com") ||
    d.includes("walmart.com") ||
    d.includes("target.com") ||
    d.includes("rakuten.") ||
    d.includes("mercari.")
  ) {
    return "retailer";
  }

  if (
    d.includes("medium.com") ||
    d.includes("substack.com") ||
    d.includes("wordpress.com") ||
    d.includes("blogspot.com")
  ) {
    return "blog";
  }

  return "other";
}

function sourceTypeFromCatalog(
  sourceKind: string,
): WorldSearchResult["sourceType"] {
  switch (sourceKind) {
    case "brand_official":
      return "brand_official";

    case "retailer":
      return "retailer";

    case "magazine":
      return "magazine";

    case "news":
      return "news";

    case "editorial":
      return "editorial";

    case "sns":
      return "sns";

    case "blog":
      return "blog";

    default:
      return "other";
  }
}

/* =========================================================
 * Tavily page classification
 *
 * A Tavily result is NOT automatically a product page.
 * Search results may be product pages, news, editorial,
 * category pages, calendars, SNS, blogs, etc.
 * ======================================================= */

const NON_PRODUCT_PATH_PATTERNS = [
  /\/article(?:s)?(?:\/|$)/i,
  /\/blogs?(?:\/|$)/i,
  /\/stories?(?:\/|$)/i,
  /\/editorial(?:\/|$)/i,
  /\/exclusives?(?:\/|$)/i,
  /\/press(?:\/|$)/i,
  /\/calendar(?:\/|$)/i,
  /\/events?(?:\/|$)/i,
  /\/category(?:\/|$)/i,
  /\/categories(?:\/(?!.*\/p(?:\/|$))|$)/i,
  /\/collection(?:s)?(?:\/(?!.*\/products\/[^/?#]+)|$)/i,
  /\/tag(?:\/|$)/i,
  /\/tags(?:\/|$)/i,
  /\/search(?:\/|$)/i,
  /\/archive(?:\/|$)/i,
  /\/archives(?:\/|$)/i,
  /\/author(?:\/|$)/i,
  /\/authors(?:\/|$)/i,
  /\/about(?:\/|$)/i,
  /\/press-release(?:\/|$)/i,
  /\/press-releases(?:\/|$)/i,
  /\/news(?:\/|$)/i,
  /\/journal(?:\/|$)/i,
  /\/lookbook(?:\/|$)/i,
  /\/magazine(?:\/|$)/i,
  /\/books?(?:\/|$)/i,
];

const NON_PRODUCT_TITLE_PATTERNS = [
  /\bnews\b/i,
  /\barticle\b/i,
  /\barticles\b/i,
  /\bblog\b/i,
  /\beditorial\b/i,
  /\bcalendar\b/i,
  /\bevent\b/i,
  /\bevents\b/i,
  /\bcategory\b/i,
  /\bcollection\b/i,
  /\bcollections\b/i,
  /\bpress release\b/i,
  /\binterview\b/i,
  /\breview\b/i,
  /\btrend report\b/i,
];

const PRODUCT_PATH_PATTERNS = [
  /\/products?\/[^/?#]+/i,
  /\/item\/[^/?#]+/i,
  /\/items\/[^/?#]+/i,
  /\/shop\/[^/?#]+/i,
  /\/store\/[^/?#]+/i,
  /\/p\/[^/?#]+/i,
  /\/dp\/[a-z0-9]+/i,
  /\/gp\/product\/[a-z0-9]+/i,
  /\/sku\/[^/?#]+/i,
  /\/goods\/[^/?#]+/i,
  /\/pd\/[^/?#]+/i,
];

const PRODUCT_TEXT_PATTERNS = [
  /\bbuy\b/i,
  /\bshop now\b/i,
  /\badd to cart\b/i,
  /\badd to bag\b/i,
  /\bprice\b/i,
  /\bsku\b/i,
  /\bproduct\b/i,
  /\bsize\b/i,
  /\bcolor\b/i,
  /\bcolour\b/i,
  /\bingredients\b/i,
  /\bvolume\b/i,
  /\bml\b/i,
  /\boz\b/i,
];

export function classifyTavilyResult(
  title: string,
  url: string,
  snippet: string,
  sourceType: WorldSearchResult["sourceType"],
): WorldSearchSourceRole {
  const path = getPath(url);
  const text = `${title}\n${snippet}`;

  /* Search result pages are never product pages. */
  try {
    const parsedUrl = new URL(url);
    const searchParams = parsedUrl.searchParams;

    if (isStoreOrBrandHomepage(url)) {
      return "general";
    }

    if (isAssetOrNonProductUrl(url)) {
      return "general";
    }

    if (["q", "query", "search", "k"].some((key) => searchParams.has(key))) {
      return "general";
    }

    if (
      /(^|\.)openbeautyfacts\.org$/i.test(parsedUrl.hostname) &&
      /\/product\//i.test(parsedUrl.pathname)
    ) {
      return "product";
    }
  } catch {
    // Keep existing classification for malformed URLs.
  }

  /*
   * SNS is never a product page candidate.
   */
  if (sourceType === "sns") {
    return "general";
  }

  /*
   * Strong URL-level exclusions always win.
   * This specifically prevents paths such as:
   * /news/calendar/
   * from becoming productUrl.
   */
  if (
    NON_PRODUCT_PATH_PATTERNS.some((pattern) =>
      pattern.test(path),
    )
  ) {
    return "general";
  }

  /*
   * Known news domains remain news even when the URL path
   * itself does not contain /news/.
   */
  if (
    sourceType === "news" ||
    /(^|\.)prtimes\.jp$/i.test(new URL(url).hostname)
  ) {
    return "news";
  }

  /*
   * Magazine/blog/editorial sources are useful search results,
   * but they are not direct product pages.
   */
  if (
    sourceType === "magazine" ||
    sourceType === "blog" ||
    sourceType === "editorial"
  ) {
    return "general";
  }

  /*
   * Titles that clearly describe articles, calendars,
   * interviews, reviews, etc. are not product pages.
   */
  if (
    NON_PRODUCT_TITLE_PATTERNS.some((pattern) =>
      pattern.test(title),
    )
  ) {
    return "general";
  }

  /*
   * A strong product URL is enough to classify the result
   * as a product candidate.
   */
  if (
    PRODUCT_PATH_PATTERNS.some((pattern) =>
      pattern.test(path),
    )
  ) {
    return "product";
  }

  /*
   * Retailers can expose product detail pages without a
   * /product/ path. Only classify them as product candidates
   * when the result contains multiple product-specific signals.
   */
  if (sourceType === "retailer") {
    const productSignals = PRODUCT_TEXT_PATTERNS.filter(
      (pattern) => pattern.test(text),
    ).length;

    return productSignals >= 2
      ? "product"
      : "general";
  }

  /*
   * Unknown/brand domains need a concrete product path.
   * Snippet words like buy/price are not enough; those also
   * appear on brand homepages, listicles, and ads.
   */
  return "general";
}

/* =========================================================
 * Catalog World Search
 * ======================================================= */

const RESIDENT_CATEGORY_ALIASES: Record<string, string[]> = {
  "美容": ["beauty"],
  "美容・コスメ": ["beauty"],
  "コスメ": ["beauty"],
  "メイク": ["beauty"],
  "スキンケア": ["beauty"],
  "ライフスタイル": [
    "accessories",
    "fragrance",
    "japan_brands",
    "trending",
  ],
  "雑貨": ["accessories", "japan_brands"],
  "インテリア": ["accessories", "japan_brands"],
  "ファッション": ["fashion"],
  "香水": ["fragrance"],
  "フレグランス": ["fragrance"],
  "アクセサリー": ["accessories"],
  "ティーン": ["teen"],
  "若者": ["teen"],
  "日本ブランド": ["japan_brands"],
  "トレンド": ["trending"],
  cosmetics: ["beauty"],
  skincare: ["beauty"],
  fragrance: ["fragrance"],
  shoes: ["fashion"],
  bags: ["accessories"],
  gadgets: ["tech"],
  electronics: ["tech"],
  audio: ["tech"],
  "smart devices": ["tech"],
  beverage: ["food"],
  snacks: ["food"],
  sweets: ["food"],
  interior: ["lifestyle", "japan_brands"],
  kitchen: ["lifestyle"],
  household: ["lifestyle"],
  fitness: ["sports"],
  training: ["sports"],
  wellness: ["lifestyle"],
  pet: ["lifestyle"],
  "pet food": ["lifestyle"],
  "pet care": ["lifestyle"],
  "pet accessories": ["accessories"],
};

function normalizeResidentInterests(
  values: string[],
): string[] {
  const normalized = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) continue;

    normalized.add(trimmed);

    for (const [alias, categories] of Object.entries(
      RESIDENT_CATEGORY_ALIASES,
    )) {
      if (trimmed.includes(alias.toLowerCase())) {
        for (const category of categories) {
          normalized.add(category);
        }
      }
    }
  }

  return [...normalized];
}

function matchesResident(
  product: (typeof CATALOG_PRODUCTS)[number],
  query: WorldSearchQuery,
): boolean {
  const searchable = [
    product.name,
    product.brand,
    product.subcategory,
    product.subcategoryLabel,
    product.description,
    ...(product.collections ?? []),
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const interests = normalizeResidentInterests([
    ...query.interests,
    ...query.preferredCategories,
  ]);

  if (interests.length === 0) {
    return true;
  }

  return interests.some((interest) =>
    searchable.includes(interest),
  );
}

class CatalogWorldSearchProvider
  implements WorldSearchProvider
{
  async search(
    query: WorldSearchQuery,
  ): Promise<WorldSearchResult[]> {
    const matched = CATALOG_PRODUCTS
      .filter((product) =>
        matchesResident(product, query),
      )
      .sort(
        (a, b) =>
          (b.popularityScore ?? 0) -
          (a.popularityScore ?? 0),
      )
      .slice(0, 20);

    const results: WorldSearchResult[] = [];

    for (const product of matched) {
      const url = product.purchaseUrl || product.sourceUrl;
      if (!url) continue;

      const domain = getDomain(url);

      results.push({
        title:
          product.name.trim().startsWith(product.brand.trim())
            ? product.name
            : `${product.brand} ${product.name}`,
        url,
        snippet: [
          product.description,
          `カテゴリー: ${product.collections?.join(", ") ?? ""}`,
          `サブカテゴリー: ${
            product.subcategoryLabel ?? product.subcategory ?? ""
          }`,
          `情報源: ${product.sourceTitle ?? ""}`,
        ]
          .filter(Boolean)
          .join("\n"),
        sourceType: sourceTypeFromCatalog(product.sourceKind),
        domain,
        imageUrl: product.imageUrl || null,
        publishedAt: product.publishedAt ?? null,
        origin: "catalog",
        sourceRole:
          /\/news(?:\/|$)/i.test(getPath(url))
            ? "general"
            : classifyTavilyResult(
                `${product.brand} ${product.name}`,
                url,
                product.description ?? "",
                sourceTypeFromCatalog(product.sourceKind),
              ),
      });
    }

    return results;
  }
}

/* =========================================================
 * Tavily Web Search
 * ======================================================= */

class TavilyWorldSearchProvider
  implements WorldSearchProvider
{
  async search(
    query: WorldSearchQuery,
  ): Promise<WorldSearchResult[]> {
    const apiKey =
      process.env.TAVILY_API_KEY;

    if (!apiKey) {
      console.warn(
        "WORLD SEARCH: TAVILY_API_KEY is not configured.",
      );

      return [];
    }

    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query.query,
          search_depth: "advanced",
          max_results: 15,
          include_answer: false,
          include_raw_content: true,
          exclude_domains: [
            "youtube.com",
            "instagram.com",
            "tiktok.com",
            "facebook.com",
            "x.com",
            "twitter.com",
            "pinterest.com",
            "wikipedia.org",
            "reuters.com",
            "bbc.com",
            "cnn.com",
            "theguardian.com",
            "apnews.com",
            "medium.com",
            "substack.com",
          ],
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `Tavily search failed: ${response.status} ${body}`,
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        raw_content?: string | null;
        published_date?: string;
      }>;
    };

    if (!Array.isArray(data.results)) {
      return [];
    }

    const results: WorldSearchResult[] = [];

    for (const result of data.results) {
      const title =
        typeof result.title === "string"
          ? repairMojibake(result.title.trim())
          : "";

      const url =
        typeof result.url === "string"
          ? result.url.trim()
          : "";

      const snippet =
        typeof result.content === "string"
          ? repairMojibake(result.content.trim())
          : "";

      if (!title || !url) continue;

      const domain = getDomain(url);
      const sourceType =
        sourceTypeFromDomain(domain);

      const sourceRole =
        classifyTavilyResult(
          title,
          url,
          snippet,
          sourceType,
        );

      results.push({
        title,
        url,
        snippet,
        sourceType,
        domain,
        imageUrl: null,
        publishedAt:
          typeof result.published_date === "string"
            ? result.published_date
            : null,
        sourceRole,
        origin: "web",
        rawContent:
          typeof result.raw_content === "string"
            ? result.raw_content
            : null,
      });
    }

    return results;
  }
}

/* =========================================================
 * Combined World Search
 * Catalog + Tavily + Open Beauty Facts (beauty queries).
 *
 * Tavily results retain their classification:
 * product / news / general.
 * Open Beauty Facts results are real product pages.
 * ======================================================= */

const MAX_EXTRACT_SOURCE_PAGES = 8;
const MAX_EXTRACTED_PRODUCT_URLS = 8;
const MAX_IMAGE_FETCHES = 5;
const MIN_EXTRACT_HTML_BYTES = 8000;

const LIFESTYLE_SEARCH_NOISE = new Set([
  "cafe",
  "cafes",
  "coffee",
  "travel",
  "culture",
  "trend",
  "trends",
  "lifestyle",
  "photography",
  "cycling",
  "hiking",
  "museum",
  "museums",
  "yoga",
  "film",
  "gardening",
  "baking",
  "climbing",
  "tea",
  "camping",
  "book",
  "books",
  "vinyl",
  "indie-games",
  "architecture",
  "street-food",
  "home-cooking",
  "pricing",
  "styling",
  "friends",
  "people",
  "media",
  "news",
  "daily",
  "everyday",
]);

const PRODUCT_HUNT_SIGNAL =
  /beauty|skincare|fragrance|perfume|cosmetic|makeup|fashion|shoe|sneaker|bag|watch|ceramic|stationer|notebook|\bpen\b|interior|gadget|electronic|audio|food|snack|beverage|fitness|pet|home|tech|jacket|apparel|accessor|serum|moisturizer|outdoor|camp|hiking|tent|backpack|baby|kids|child|stroller|garden|plant|planter|seed|wellness|bath|sleep|supplement|craft|diy|yarn|japan|香水|美容|コスメ|ファッション|靴|バッグ|スキンケア|香り|アウトドア|キャンプ|ベビー|キッズ|文房具|園芸|ウェルネス|日本製/;

export function isLifestyleSearchNoise(value: string): boolean {
  return LIFESTYLE_SEARCH_NOISE.has(value.trim().toLowerCase());
}

export function isProductHuntTerm(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isLifestyleSearchNoise(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  return (
    PRODUCT_HUNT_SIGNAL.test(lower) ||
    lower.split(/[\s/_-]+/).some((part) => PRODUCT_HUNT_SIGNAL.test(part))
  );
}

type ProductSearchLens =
  | "beauty"
  | "fragrance"
  | "fashion"
  | "food"
  | "tech"
  | "home"
  | "fitness"
  | "wellness"
  | "pet"
  | "outdoor"
  | "kids"
  | "stationery"
  | "garden"
  | "craft"
  | "japan"
  | "general";

function lensFromHaystack(haystack: string): ProductSearchLens {
  const text = haystack.toLowerCase();
  if (/baby|kids|child|stroller|parenting|ベビー|キッズ/.test(text)) {
    return "kids";
  }
  if (/outdoor|camping|hiking|tent|backpack|travel gear|アウトドア|キャンプ/.test(text)) {
    return "outdoor";
  }
  if (/stationer|notebook|\bpen\b|pencil|desk tools|文房具/.test(text)) {
    return "stationery";
  }
  if (/garden|planter|seeds|gardening|園芸/.test(text)) {
    return "garden";
  }
  if (/\bdiy\b|handmade|yarn|workshop tools|クラフト道具/.test(text)) {
    return "craft";
  }
  if (
    /japanese products|japan brands|made in japan|japan_brands|日本製|日本商品/.test(
      text,
    )
  ) {
    return "japan";
  }
  if (
    /wellness|self-care|bath|sleep|supplement|ボディケア/.test(text) &&
    !/fitness|sports|training|フィットネス/.test(text)
  ) {
    return "wellness";
  }
  if (/fragrance|perfume|香水|フレグランス/.test(text) &&
      !/skincare|cosmetic|makeup|beauty|美容|コスメ/.test(text)) {
    return "fragrance";
  }
  if (/beauty|cosmetic|skincare|makeup|美容|コスメ|スキンケア/.test(text)) {
    return "beauty";
  }
  if (/pet food|pet care|pet accessories|\bpet\b|ペット/.test(text)) {
    return "pet";
  }
  if (/fitness|sports|training|フィットネス/.test(text)) {
    return "fitness";
  }
  if (/food|beverage|snack|sweet|食品|飲料/.test(text)) {
    return "food";
  }
  if (/gadget|electronics|audio|smart device|\btech\b|ガジェット/.test(text)) {
    return "tech";
  }
  if (/interior|kitchen|household|\bhome\b|インテリア|キッチン/.test(text)) {
    return "home";
  }
  if (/fashion|shoes|\bbags\b|ファッション|靴|バッグ/.test(text)) {
    return "fashion";
  }
  return "general";
}

function detectSearchLens(input: {
  interests: string[];
  preferredCategories: string[];
  expertise: string[];
  huntingSpecialty?: string;
}): ProductSearchLens {
  const fromSpecialty = lensFromHaystack(input.huntingSpecialty ?? "");
  if (fromSpecialty !== "general") return fromSpecialty;
  const axis = lensFromHaystack(
    [...input.expertise, ...input.preferredCategories].join(" "),
  );
  if (axis !== "general") return axis;
  return lensFromHaystack(
    input.interests.filter((item) => !isLifestyleSearchNoise(item)).join(" "),
  );
}

function productPageIntent(lens: ProductSearchLens, language?: string): string {
  const ja = (language || "").toLowerCase().startsWith("ja");
  switch (lens) {
    case "beauty":
      return ja
        ? "公式 商品ページ 美容液 化粧水 成分 容量 ml 購入"
        : "official product page inurl:product serum moisturizer ingredients ml buy";
    case "fragrance":
      return ja
        ? "公式 香水 商品ページ 容量 ml 購入"
        : "official perfume product page inurl:product eau de parfum ml buy";
    case "fashion":
      return ja
        ? "公式 商品ページ ジャケット スニーカー バッグ サイズ カラー 価格 購入"
        : "official product page inurl:products sneakers bag size color price buy";
    case "food":
      return ja
        ? "公式 商品ページ 原材料 内容量 購入"
        : "official product page inurl:product ingredients buy";
    case "tech":
      return ja
        ? "公式 商品ページ スペック sku 購入"
        : "official product page inurl:dp specs sku buy";
    case "home":
      return ja
        ? "公式 商品ページ サイズ 素材 購入"
        : "official product page inurl:products dimensions buy";
    case "fitness":
      return ja
        ? "公式 商品ページ サイズ スペック 購入"
        : "official product page inurl:product size specs buy";
    case "pet":
      return ja
        ? "公式 ペット用品 商品ページ 原材料 内容量 購入"
        : "official pet product page inurl:product ingredients buy";
    case "wellness":
      return ja
        ? "公式 商品ページ 入浴 睡眠 ボディケア 成分 購入"
        : "official product page inurl:product bath sleep body care ingredients buy";
    case "outdoor":
      return ja
        ? "公式 商品ページ キャンプ テント スペック 重量 購入"
        : "official product page inurl:product tent pack specs weight buy";
    case "kids":
      return ja
        ? "公式 ベビー キッズ 商品ページ サイズ 素材 購入"
        : "official baby kids product page inurl:product size material buy";
    case "stationery":
      return ja
        ? "公式 文房具 商品ページ ペン ノート 購入"
        : "official stationery product page inurl:product pen notebook buy";
    case "garden":
      return ja
        ? "公式 園芸 商品ページ 鉢 サイズ 購入"
        : "official garden product page inurl:product planter size buy";
    case "craft":
      return ja
        ? "公式 手芸 工具 商品ページ 材料 購入"
        : "official craft diy product page inurl:product tools materials buy";
    case "japan":
      return ja
        ? "公式 日本製 商品ページ 産地 容量 購入"
        : "official made in Japan product page inurl:product buy";
    default:
      return ja
        ? "公式 商品ページ 価格 購入"
        : "official product page price buy";
  }
}

function resultKey(url: string): string | null {
  try {
    const normalized = new URL(url);
    normalized.hash = "";
    return normalized.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

function stripRawContent(result: WorldSearchResult): WorldSearchResult {
  const copy = { ...result };
  delete copy.rawContent;
  return copy;
}

function productResultFromUrl(
  url: string,
  origin: WorldSearchOrigin,
  title = "",
  snippet = "",
): WorldSearchResult | null {
  if (isAssetOrNonProductUrl(url) || isStoreOrBrandHomepage(url)) {
    return null;
  }
  const domain = getDomain(url);
  if (!domain) return null;
  const sourceType = sourceTypeFromDomain(domain);
  if (sourceType === "sns" || sourceType === "news") return null;
  const path = getPath(url);
  const hasProductPath = PRODUCT_PATH_PATTERNS.some((pattern) =>
    pattern.test(path),
  );
  if (!hasProductPath) return null;
  const sourceRole = classifyTavilyResult(
    title || titleFromProductUrl(url),
    url,
    snippet,
    sourceType,
  );
  if (sourceRole !== "product") return null;
  return {
    title: titleFromProductUrl(url, title),
    url,
    snippet:
      snippet.slice(0, 400) ||
      "Product page found on a discovered source page.",
    sourceType,
    domain,
    imageUrl: null,
    sourceRole: "product",
    origin,
  };
}

function extractProductResultsFromText(
  source: WorldSearchResult,
  text: string,
  remaining: number,
): WorldSearchResult[] {
  if (remaining <= 0 || !text) return [];
  if (source.sourceRole === "news" || source.sourceType === "sns") return [];

  const extracted: WorldSearchResult[] = [];
  const seen = new Set<string>();

  for (const url of extractUrlsFromText(text, source.url)) {
    if (extracted.length >= remaining) break;
    const key = resultKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const product = productResultFromUrl(url, "extracted");
    if (product) extracted.push(product);
  }

  return extracted;
}

async function extractProductResultsFromPages(
  sources: WorldSearchResult[],
  remaining: number,
): Promise<WorldSearchResult[]> {
  if (remaining <= 0) return [];

  const pages = sources.filter(
    (result) =>
      result.sourceRole !== "news" &&
      result.sourceType !== "sns" &&
      result.sourceType !== "news" &&
      !isAssetOrNonProductUrl(result.url) &&
      Boolean(result.url),
  );

  const extracted: WorldSearchResult[] = [];
  const seen = new Set<string>();
  let fetchedPages = 0;

  for (const page of pages) {
    if (extracted.length >= remaining) break;
    if (fetchedPages >= MAX_EXTRACT_SOURCE_PAGES) break;
    const html = await fetchPageHtml(page.url);
    if (!html || html.length < MIN_EXTRACT_HTML_BYTES) continue;
    fetchedPages += 1;
    for (const url of extractUrlsFromText(html, page.url)) {
      if (extracted.length >= remaining) break;
      const key = resultKey(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const product = productResultFromUrl(url, "extracted");
      if (product) extracted.push(product);
    }
  }

  return extracted;
}

function imageFetchPriority(result: WorldSearchResult): number {
  if (result.origin === "open_beauty_facts") return 0;
  if (result.origin === "extracted") return 1;
  if (
    /imall\.com|aliexpress\.|ebay\.|amazon\.|poshmark\.|made-in-china/.test(
      result.domain,
    )
  ) {
    return 9;
  }
  return 2;
}

async function enrichProductImages(
  results: WorldSearchResult[],
): Promise<WorldSearchResult[]> {
  const pending = results
    .filter(
      (result) =>
        result.sourceRole === "product" &&
        result.origin !== "catalog" &&
        !isAssetOrNonProductUrl(result.url) &&
        !isAcceptableProductPageImage(result.imageUrl),
    )
    .sort((a, b) => imageFetchPriority(a) - imageFetchPriority(b));

  const toFetch = pending.slice(0, MAX_IMAGE_FETCHES);
  const fetched = await Promise.all(
    toFetch.map(async (result) => {
      const html = await fetchPageHtml(result.url);
      if (!html) return result;
      const imageUrl = extractProductImageFromHtml(html, result.url);
      return imageUrl ? { ...result, imageUrl } : result;
    }),
  );

  const byKey = new Map<string, WorldSearchResult>();
  for (const result of fetched) {
    const key = resultKey(result.url);
    if (key) byKey.set(key, result);
  }

  return results.map((result) => {
    const key = resultKey(result.url);
    return key && byKey.has(key) ? byKey.get(key)! : result;
  });
}

class CombinedWorldSearchProvider
  implements WorldSearchProvider
{
  private readonly webProvider =
    new TavilyWorldSearchProvider();

  private readonly catalogProvider =
    new CatalogWorldSearchProvider();

  private readonly beautyFactsProvider =
    new OpenBeautyFactsWorldSearchProvider();

  async search(
    query: WorldSearchQuery,
  ): Promise<WorldSearchResult[]> {
    console.log(
      "=== NEWFIND WORLD SEARCH ===",
    );

    console.log(
      "resident:",
      query.residentName,
    );

    console.log(
      "query:",
      query.query,
    );

    let beautyResults: WorldSearchResult[] =
      [];

    if (isBeautyWorldSearchQuery(query)) {
      try {
        beautyResults =
          await this.beautyFactsProvider.search(
            query,
          );

        console.log(
          "WORLD SEARCH: Open Beauty Facts results:",
          beautyResults.length,
        );
      } catch (error) {
        console.error(
          "WORLD SEARCH: Open Beauty Facts search failed:",
          error,
        );
      }
    }

    let webResults: WorldSearchResult[] =
      [];

    try {
      webResults =
        await this.webProvider.search(
          query,
        );

      console.log(
        "WORLD SEARCH: web results:",
        webResults.length,
      );

      console.log(
        "WORLD SEARCH: web product results:",
        webResults.filter(
          isProductSource,
        ).length,
      );

      console.log(
        "WORLD SEARCH: web news results:",
        webResults.filter(
          isNewsSignal,
        ).length,
      );

      console.log(
        "WORLD SEARCH: web general results:",
        webResults.filter(
          (result) =>
            result.sourceRole ===
            "general",
        ).length,
      );
    } catch (error) {
      console.error(
        "WORLD SEARCH: web search failed:",
        error,
      );
    }

    const extracted: WorldSearchResult[] = [];
    const seenExtracted = new Set<string>();
    const rememberExtracted = (items: WorldSearchResult[]) => {
      for (const item of items) {
        if (extracted.length >= MAX_EXTRACTED_PRODUCT_URLS) break;
        const key = resultKey(item.url);
        if (!key || seenExtracted.has(key)) continue;
        if (webResults.some((result) => resultKey(result.url) === key)) {
          continue;
        }
        seenExtracted.add(key);
        extracted.push(item);
      }
    };

    for (const result of webResults) {
      if (extracted.length >= MAX_EXTRACTED_PRODUCT_URLS) break;
      rememberExtracted(
        extractProductResultsFromText(
          result,
          `${result.snippet}\n${result.rawContent ?? ""}`,
          MAX_EXTRACTED_PRODUCT_URLS - extracted.length,
        ),
      );
    }

    const liveProductCount =
      webResults.filter(isProductSource).length + extracted.length;

    if (liveProductCount < 2) {
      const pageExtracted = await extractProductResultsFromPages(
        webResults.filter((result) => result.sourceRole === "general"),
        MAX_EXTRACTED_PRODUCT_URLS - extracted.length,
      );
      rememberExtracted(pageExtracted);
    }

    if (extracted.length) {
      console.log(
        "WORLD SEARCH: extracted product urls:",
        extracted.length,
      );
    }

    let catalogResults: WorldSearchResult[] =
      [];

    try {
      catalogResults =
        await this.catalogProvider.search(
          query,
        );

      console.log(
        "WORLD SEARCH: catalog results:",
        catalogResults.length,
      );
    } catch (error) {
      console.error(
        "WORLD SEARCH: catalog search failed:",
        error,
      );
    }

    const liveProducts = [
      ...beautyResults,
      ...webResults.filter(isProductSource),
      ...extracted,
    ];
    const withImages = await enrichProductImages(liveProducts);

    console.log(
      "WORLD SEARCH: live products with images:",
      withImages.filter((result) =>
        isAcceptableProductPageImage(result.imageUrl),
      ).length,
    );

    const combined = [
      ...withImages,
      ...webResults.filter((result) => result.sourceRole !== "product"),
      ...catalogResults,
    ];

    const unique =
      new Map<
        string,
        WorldSearchResult
      >();

    for (const result of combined) {
      const key = resultKey(result.url);
      if (!key || unique.has(key)) continue;
      unique.set(key, stripRawContent(result));
    }

    const results = [
      ...unique.values(),
    ].slice(0, 30);

    console.log(
      "WORLD SEARCH: final results:",
      results.length,
    );

    return results;
  }
}

const defaultProvider =
  new CombinedWorldSearchProvider();

export async function searchWorld(
  query: WorldSearchQuery,
): Promise<WorldSearchResult[]> {
  return defaultProvider.search(
    query,
  );
}

const GENERIC_SEARCH_TERMS = new Set([
  "fashion",
  "beauty",
  "food",
  "tech",
  "home",
  "lifestyle",
  "product",
  "products",
  "trending",
  "new brands",
  "new product",
]);

const GENERIC_BRAND_PATTERN =
  /independent|emerging|atelier|startup|maker|studio|house|label|overseas|regional|nordic|formula lab|not-yet-in-japan/i;

function pickDistinctTerms(values: string[], max: number): string[] {
  const picked: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (GENERIC_SEARCH_TERMS.has(trimmed.toLowerCase())) continue;
    if (picked.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      continue;
    }
    picked.push(trimmed);
    if (picked.length >= max) break;
  }
  return picked;
}

function pickFavoriteBrands(brands: string[]): string[] {
  return brands
    .map((brand) => brand.trim())
    .filter((brand) => brand && !GENERIC_BRAND_PATTERN.test(brand))
    .slice(0, 2);
}

export function selectProductHuntTerms(input: {
  interests: string[];
  preferredCategories: string[];
  expertise?: string[];
  discoveryKeywords?: string[];
}): string[] {
  const categories = input.preferredCategories.filter(
    (item) =>
      item.trim() &&
      !isLifestyleSearchNoise(item) &&
      item.trim().toLowerCase() !== "lifestyle",
  );
  const specificCategories = categories.filter(
    (item) => !GENERIC_SEARCH_TERMS.has(item.trim().toLowerCase()),
  );
  const huntInterests = input.interests.filter(isProductHuntTerm);
  const huntExpertise = (input.expertise ?? []).filter(isProductHuntTerm);
  const keywords = (input.discoveryKeywords ?? []).filter(isProductHuntTerm);
  return pickDistinctTerms(
    [...keywords, ...specificCategories, ...huntInterests, ...huntExpertise],
    4,
  );
}

/* =========================================================
 * Resident Search Query
 * ======================================================= */

export function buildResidentSearchQuery(
  input: {
    residentName: string;
    interests: string[];
    preferredCategories: string[];
    goals: string[];
    expertise?: string[];
    values?: string[];
    country?: string | null;
    language?: string;
    favoriteBrands?: string[];
    region?: string | null;
    discoveryKeywords?: string[];
    huntingSpecialty?: string;
  },
): WorldSearchQuery {
  const interests = input.interests.filter(Boolean);
  const categories = input.preferredCategories.filter(Boolean);
  const goals = input.goals.filter(Boolean);
  const expertise = (input.expertise ?? []).filter(Boolean);
  const values = (input.values ?? []).filter(Boolean);
  const discoveryKeywords = (input.discoveryKeywords ?? []).filter(Boolean);
  const huntInterests = interests.filter(isProductHuntTerm);
  const favoriteBrands = pickFavoriteBrands(input.favoriteBrands ?? []);
  const lens = detectSearchLens({
    huntingSpecialty: input.huntingSpecialty,
    interests: [...discoveryKeywords, ...huntInterests],
    preferredCategories: categories,
    expertise,
  });
  const interestTerms = selectProductHuntTerms({
    interests,
    preferredCategories: categories,
    expertise,
    discoveryKeywords,
  });
  const region = (input.region || input.country || "").trim();
  const queryParts = [
    ...favoriteBrands,
    ...interestTerms,
    productPageIntent(lens, input.language),
    region ? region : "",
  ].filter(Boolean);

  return {
    residentId: "",
    residentName: input.residentName,
    interests: huntInterests.length ? huntInterests : interests,
    preferredCategories: categories,
    goals,
    query: queryParts.join(" ").replace(/\s+/g, " ").trim(),
    country: input.country ?? null,
    language: input.language ?? "en",
    favoriteBrands: input.favoriteBrands ?? [],
    expertise,
    values,
    region: input.region ?? null,
    discoveryKeywords,
    huntingSpecialty: input.huntingSpecialty,
  };
}

