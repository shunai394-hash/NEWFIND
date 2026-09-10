import { CATALOG_PRODUCTS } from "@/lib/products/catalog";
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
};

export type WorldSearchSourceRole = "product" | "news" | "general";

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
    d.includes("theguardian.com")
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
  /\/collection(?:\/|$)/i,
  /\/collections(?:\/|$)/i,
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
  /\/products?(?:\/|$)/i,
  /\/item(?:\/|$)/i,
  /\/items(?:\/|$)/i,
  /\/shop(?:\/|$)/i,
  /\/store(?:\/|$)/i,
  /\/p(?:\/|$)/i,
  /\/dp\/[a-z0-9]/i,
  /\/sku(?:\/|$)/i,
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

    if (["q", "query", "search", "k"].some((key) => searchParams.has(key))) {
      return "general";
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
   * For unknown/brand domains, require product-specific
   * evidence instead of assuming every page is a product.
   */
  const productSignals = PRODUCT_TEXT_PATTERNS.filter(
    (pattern) => pattern.test(text),
  ).length;

  return productSignals >= 2
    ? "product"
    : "general";
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
        title: `${product.brand} ${product.name}`,
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
          include_raw_content: false,
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
      });
    }

    return results;
  }
}

/* =========================================================
 * Combined World Search
 * Catalog + Tavily.
 *
 * Tavily results retain their classification:
 * product / news / general.
 * ======================================================= */

class CombinedWorldSearchProvider
  implements WorldSearchProvider
{
  private readonly webProvider =
    new TavilyWorldSearchProvider();

  private readonly catalogProvider =
    new CatalogWorldSearchProvider();

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

    const combined = [
      ...webResults,
      ...catalogResults,
    ];

    const unique =
      new Map<
        string,
        WorldSearchResult
      >();

    for (const result of combined) {
      try {
        const normalized =
          new URL(result.url);

        normalized.hash = "";

        const key =
          normalized
            .toString()
            .replace(/\/$/, "")
            .toLowerCase();

        if (!unique.has(key)) {
          unique.set(key, result);
        }
      } catch {
        continue;
      }
    }

    const results = [
      ...unique.values(),
    ].slice(0, 25);

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
  },
): WorldSearchQuery {
  const interests =
    input.interests.filter(Boolean);

  const categories =
    input.preferredCategories.filter(
      Boolean,
    );

  const goals =
    input.goals.filter(Boolean);

  const expertise =
    (input.expertise ?? []).filter(Boolean);

  const values =
    (input.values ?? []).filter(Boolean);

  const queryParts = [
    ...categories,
    ...interests,
    ...expertise,
    ...values,
    ...goals,
    "new product",
    "trending",
  ];

  return {
    residentId: "",
    residentName:
      input.residentName,
    interests,
    preferredCategories:
      categories,
    goals,
    query:
      queryParts.join(" "),
    country: input.country ?? null,
    language: input.language ?? "en",
  };
}

