import type {
  WorldSearchProvider,
  WorldSearchQuery,
  WorldSearchResult,
} from "@/lib/ai/world-search";

const OBF_ORIGIN = "https://world.openbeautyfacts.org";
const USER_AGENT = "NEWFIND/1.0 (world-search; beauty-hunter)";

const BEAUTY_HINTS = [
  "beauty",
  "cosmetic",
  "cosmetics",
  "skincare",
  "skin care",
  "fragrance",
  "perfume",
  "makeup",
  "make-up",
  "serum",
  "moisturizer",
  "moisturiser",
  "sunscreen",
  "haircare",
  "hair care",
  "美容",
  "コスメ",
  "スキンケア",
  "化粧品",
  "香水",
  "フレグランス",
];

const CATEGORY_TAGS: Array<{ hint: string; tag: string }> = [
  { hint: "fragrance", tag: "perfumes" },
  { hint: "perfume", tag: "perfumes" },
  { hint: "香水", tag: "perfumes" },
  { hint: "フレグランス", tag: "perfumes" },
  { hint: "makeup", tag: "makeup" },
  { hint: "make-up", tag: "makeup" },
  { hint: "cosmetic", tag: "cosmetics" },
  { hint: "化粧品", tag: "cosmetics" },
  { hint: "コスメ", tag: "cosmetics" },
  { hint: "hair", tag: "hair-care" },
  { hint: "skincare", tag: "skincare" },
  { hint: "skin care", tag: "skincare" },
  { hint: "serum", tag: "skincare" },
  { hint: "スキンケア", tag: "skincare" },
  { hint: "beauty", tag: "skincare" },
  { hint: "美容", tag: "skincare" },
];

type OpenBeautyFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  url?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text?: string;
  categories?: string;
  countries?: string;
  quantity?: string;
};

function queryHaystack(query: WorldSearchQuery): string {
  return [
    query.query,
    ...query.interests,
    ...query.preferredCategories,
    ...query.goals,
  ]
    .join(" ")
    .toLowerCase();
}

export function isBeautyWorldSearchQuery(query: WorldSearchQuery): boolean {
  const haystack = queryHaystack(query);
  return BEAUTY_HINTS.some((hint) => haystack.includes(hint));
}

function beautyCategoryTag(query: WorldSearchQuery): string {
  const haystack = queryHaystack(query);
  const matched = CATEGORY_TAGS.find((item) => haystack.includes(item.hint));
  return matched?.tag ?? "skincare";
}

function beautySearchTerms(query: WorldSearchQuery): string {
  const terms = [
    ...query.preferredCategories,
    ...query.interests,
    ...query.goals,
  ]
    .map((value) => value.trim())
    .filter((value) =>
      BEAUTY_HINTS.some((hint) => value.toLowerCase().includes(hint)),
    );

  const unique = Array.from(new Set(terms)).slice(0, 6);
  return unique.join(" ") || "skincare cosmetics fragrance";
}

function productName(product: OpenBeautyFactsProduct): string {
  return (
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    ""
  );
}

function productUrl(product: OpenBeautyFactsProduct): string {
  const explicit = product.url?.trim();
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        return parsed.toString();
      }
    } catch {
      // Fall through to the canonical product page.
    }
  }

  const code = String(product.code ?? "").trim();
  return code ? `${OBF_ORIGIN}/product/${encodeURIComponent(code)}` : "";
}

function toWorldSearchResult(
  product: OpenBeautyFactsProduct,
): WorldSearchResult | null {
  const name = productName(product);
  const url = productUrl(product);
  const brand = product.brands?.trim() || "";

  if (!name || !url) return null;

  const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
    ? `${brand} - ${name}`
    : name;

  const snippet = [
    brand ? `Brand: ${brand}` : "",
    product.quantity ? `Quantity: ${product.quantity}` : "",
    product.categories ? `Categories: ${product.categories}` : "",
    product.ingredients_text
      ? `Ingredients: ${product.ingredients_text}`
      : "",
    product.countries ? `Countries: ${product.countries}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let domain = "world.openbeautyfacts.org";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // Keep the canonical Open Beauty Facts domain.
  }

  return {
    title,
    url,
    snippet,
    sourceType: "other",
    domain,
    imageUrl: product.image_front_url || product.image_url || null,
    sourceCountry: product.countries?.split(",")[0]?.trim() || null,
    sourceRole: "product",
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Open Beauty Facts search failed: ${response.status} ${body}`,
    );
  }

  return response.json();
}

function productsFromPayload(payload: unknown): OpenBeautyFactsProduct[] {
  if (!payload || typeof payload !== "object") return [];
  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];
  return products.filter(
    (item): item is OpenBeautyFactsProduct =>
      Boolean(item) && typeof item === "object",
  );
}

export class OpenBeautyFactsWorldSearchProvider
  implements WorldSearchProvider
{
  async search(query: WorldSearchQuery): Promise<WorldSearchResult[]> {
    const searchTerms = beautySearchTerms(query);
    const categoryTag = beautyCategoryTag(query);

    const searchPl = new URL(`${OBF_ORIGIN}/cgi/search.pl`);
    searchPl.searchParams.set("search_terms", searchTerms);
    searchPl.searchParams.set("search_simple", "1");
    searchPl.searchParams.set("action", "process");
    searchPl.searchParams.set("json", "1");
    searchPl.searchParams.set("page_size", "12");

    const v2 = new URL(`${OBF_ORIGIN}/api/v2/search`);
    v2.searchParams.set("categories_tags_en", categoryTag);
    v2.searchParams.set("page_size", "12");
    v2.searchParams.set(
      "fields",
      [
        "code",
        "product_name",
        "product_name_en",
        "brands",
        "url",
        "image_url",
        "image_front_url",
        "ingredients_text",
        "categories",
        "countries",
        "quantity",
      ].join(","),
    );

    const payloads = await Promise.allSettled([
      fetchJson(searchPl.toString()),
      fetchJson(v2.toString()),
    ]);

    const products: OpenBeautyFactsProduct[] = [];

    for (const payload of payloads) {
      if (payload.status !== "fulfilled") {
        console.error(
          "WORLD SEARCH: Open Beauty Facts request failed:",
          payload.reason,
        );
        continue;
      }

      products.push(...productsFromPayload(payload.value));
    }

    const unique = new Map<string, WorldSearchResult>();

    for (const product of products) {
      const result = toWorldSearchResult(product);
      if (!result) continue;

      try {
        const key = new URL(result.url)
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

    return [...unique.values()].slice(0, 15);
  }
}
