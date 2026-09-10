import { CATALOG_PRODUCTS } from "@/lib/products/catalog";

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
};

export interface WorldSearchProvider {
  search(
    query: WorldSearchQuery,
  ): Promise<WorldSearchResult[]>;
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
 * Catalog World Search
 * ======================================================= */

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

  const interests = [
    ...query.interests,
    ...query.preferredCategories,
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

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

    return matched
      .map((product) => {
        const url =
          product.purchaseUrl ||
          product.sourceUrl;

        if (!url) {
          return null;
        }

        const domain = getDomain(url);

        return {
          title: `${product.brand} ${product.name}`,
          url,
          snippet: [
            product.description,
            `カテゴリー: ${
              product.collections?.join(", ") ?? ""
            }`,
            `サブカテゴリー: ${
              product.subcategoryLabel ??
              product.subcategory ??
              ""
            }`,
            `情報源: ${product.sourceTitle ?? ""}`,
          ]
            .filter(Boolean)
            .join("\n"),
          sourceType: sourceTypeFromCatalog(
            product.sourceKind,
          ),
          domain,
        };
      })
      .filter(
        (
          result,
        ): result is WorldSearchResult =>
          result !== null,
      );
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

    return data.results
      .map((result) => {
        const title =
          typeof result.title === "string"
            ? result.title.trim()
            : "";

        const url =
          typeof result.url === "string"
            ? result.url.trim()
            : "";

        const snippet =
          typeof result.content === "string"
            ? result.content.trim()
            : "";

        if (!title || !url) {
          return null;
        }

        const domain = getDomain(url);

        return {
          title,
          url,
          snippet,
          sourceType:
            sourceTypeFromDomain(domain),
          domain,
        };
      })
      .filter(
        (
          result,
        ): result is WorldSearchResult =>
          result !== null,
      );
  }
}

/* =========================================================
 * Combined World Search
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
