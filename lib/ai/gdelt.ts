import { createAdminClient } from "@/lib/supabase/admin";
import type { WorldSearchResult } from "@/lib/ai/world-search";

export const GDELT_CACHE_KEY = "gdelt:world:product-signals:v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ARTICLES = 20;

const GDELT_QUERY =
  '("new product" OR "product launch" OR "new collection" OR sneaker OR fragrance OR makeup OR fashion OR beauty OR luxury)';

type GdeltArticleRaw = {
  title?: string;
  url?: string;
  url_mobile?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  seendate?: string;
};

export type GdeltArticle = {
  title: string;
  url: string;
  domain: string;
  language: string | null;
  sourceCountry: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

type CacheRow = {
  cache_key: string;
  fetched_at: string;
  expires_at: string;
  articles: unknown;
};

let inflight: Promise<WorldSearchResult[]> | null = null;
let memoryCache: { articles: GdeltArticle[]; expiresAt: number } | null = null;

function readMemory(allowExpired: boolean) {
  if (!memoryCache) return null;
  const fresh = memoryCache.expiresAt > Date.now();
  if (!fresh && !allowExpired) return null;
  if (memoryCache.articles.length === 0 && !allowExpired) return null;
  return memoryCache;
}

function writeMemory(articles: GdeltArticle[]) {
  memoryCache = {
    articles,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function parseSeenDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function normalizeImageUrl(value: string | undefined): string | null {
  const image = typeof value === "string" ? value.trim() : "";
  if (!image) return null;
  if (!isValidHttpUrl(image)) return null;
  return image;
}

export function mapGdeltArticle(
  raw: GdeltArticleRaw,
): GdeltArticle | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!title || !url || !isValidHttpUrl(url)) return null;

  const domain =
    (typeof raw.domain === "string" ? raw.domain.trim() : "") ||
    getDomain(url);
  if (!domain) return null;

  return {
    title,
    url,
    domain: domain.replace(/^www\./, "").toLowerCase(),
    language:
      typeof raw.language === "string" && raw.language.trim()
        ? raw.language.trim()
        : null,
    sourceCountry:
      typeof raw.sourcecountry === "string" && raw.sourcecountry.trim()
        ? raw.sourcecountry.trim()
        : null,
    imageUrl: normalizeImageUrl(raw.socialimage),
    publishedAt: parseSeenDate(raw.seendate),
  };
}

export function gdeltArticleToWorldResult(
  article: GdeltArticle,
): WorldSearchResult {
  return {
    title: article.title,
    url: article.url,
    snippet: [
      article.sourceCountry ? `source country: ${article.sourceCountry}` : "",
      article.language ? `language: ${article.language}` : "",
      "World news discovery signal. This is not a product page.",
    ]
      .filter(Boolean)
      .join(" · "),
    sourceType: "news",
    domain: article.domain,
    imageUrl: article.imageUrl,
    language: article.language,
    sourceCountry: article.sourceCountry,
    publishedAt: article.publishedAt,
    sourceRole: "news",
  };
}

function asArticles(value: unknown): GdeltArticle[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as GdeltArticleRaw & Partial<GdeltArticle>;
      if (typeof row.title === "string" && typeof row.url === "string") {
        if ("sourceCountry" in row || "imageUrl" in row) {
          if (!isValidHttpUrl(row.url)) return null;
          return {
            title: row.title.trim(),
            url: row.url.trim(),
            domain: String(row.domain ?? getDomain(row.url)).toLowerCase(),
            language: row.language ?? null,
            sourceCountry: row.sourceCountry ?? null,
            imageUrl: row.imageUrl ?? normalizeImageUrl(row.socialimage),
            publishedAt: row.publishedAt ?? parseSeenDate(row.seendate),
          } satisfies GdeltArticle;
        }
      }
      return mapGdeltArticle(row);
    })
    .filter((item): item is GdeltArticle => item !== null);
}

function logWorldNews(
  articles: GdeltArticle[],
  cache: "fresh" | "stale" | "miss" | "write" | "bypass",
) {
  console.log("=== GDELT WORLD NEWS ===");
  console.log("GDELT cache:", cache);
  console.log("GDELT articles:", articles.length);
  for (const article of articles) {
    console.log({
      title: article.title,
      url: article.url,
      domain: article.domain,
      language: article.language,
      sourceCountry: article.sourceCountry,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
    });
  }
  console.log("=== END GDELT WORLD NEWS ===");
}

function tryAdminClient() {
  try {
    return createAdminClient();
  } catch (error) {
    console.warn(
      "GDELT cache: admin client unavailable, using request-local fetch only.",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function readCache(
  allowExpired: boolean,
): Promise<{ articles: GdeltArticle[]; fresh: boolean } | null> {
  const admin = tryAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("ai_world_news_cache")
    .select("cache_key, fetched_at, expires_at, articles")
    .eq("cache_key", GDELT_CACHE_KEY)
    .maybeSingle();

  if (error) {
    console.warn("GDELT cache read failed:", error.message);
    return null;
  }

  const row = data as CacheRow | null;
  if (!row) return null;

  const articles = asArticles(row.articles);
  const fresh = new Date(row.expires_at).getTime() > Date.now();
  if (!fresh && !allowExpired) return null;
  if (articles.length === 0 && !allowExpired) return null;

  return { articles, fresh };
}

async function writeCache(articles: GdeltArticle[]) {
  const admin = tryAdminClient();
  if (!admin) return;

  const now = new Date();
  const payload = {
    cache_key: GDELT_CACHE_KEY,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    articles,
  };

  const { error } = await admin
    .from("ai_world_news_cache")
    .upsert(payload, { onConflict: "cache_key" });

  if (error) {
    console.warn("GDELT cache write failed:", error.message);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGdeltArticles(
  query = GDELT_QUERY,
): Promise<GdeltArticle[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: String(MAX_ARTICLES),
    timespan: "1d",
    sort: "datedesc",
  });

  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
        headers: {
          Accept: "application/json",
          "User-Agent": "NEWFIND/1.0 (world discovery resident)",
        },
      });
    } catch (error) {
      console.warn(
        "GDELT request failed.",
        error instanceof Error ? error.message : error,
      );
      if (attempt === 2) return [];
      await sleep(3000);
      continue;
    }

    if (response.status === 429) {
      console.warn("GDELT rate limited (429). Retrying once if possible.");
      if (attempt === 2) return [];
      await sleep(8000);
      continue;
    }

    break;
  }

  if (!response) return [];

  if (!response.ok) {
    const body = await response.text();
    console.warn(
      `GDELT fetch failed: ${response.status} ${body.slice(0, 300)}`,
    );
    return [];
  }

  const text = await response.text();
  let data: { articles?: GdeltArticleRaw[] };
  try {
    data = JSON.parse(text) as { articles?: GdeltArticleRaw[] };
  } catch {
    console.warn("GDELT returned non-JSON. Falling back.");
    return [];
  }

  const articles = (data.articles ?? [])
    .map(mapGdeltArticle)
    .filter((item): item is GdeltArticle => item !== null)
    .slice(0, MAX_ARTICLES);

  const unique = new Map<string, GdeltArticle>();
  for (const article of articles) {
    const key = article.url.replace(/\/$/, "").toLowerCase();
    if (!unique.has(key)) unique.set(key, article);
  }

  return [...unique.values()];
}

async function loadSharedWorldNews(): Promise<WorldSearchResult[]> {
  const memoryFresh = readMemory(false);
  if (memoryFresh) {
    logWorldNews(memoryFresh.articles, "fresh");
    return memoryFresh.articles.map(gdeltArticleToWorldResult);
  }

  const fresh = await readCache(false);
  if (fresh?.fresh) {
    writeMemory(fresh.articles);
    logWorldNews(fresh.articles, "fresh");
    return fresh.articles.map(gdeltArticleToWorldResult);
  }

  try {
    const articles = await fetchGdeltArticles();
    if (articles.length > 0) {
      writeMemory(articles);
      await writeCache(articles);
      logWorldNews(articles, "write");
      return articles.map(gdeltArticleToWorldResult);
    }

    const memoryStale = readMemory(true);
    if (memoryStale && memoryStale.articles.length > 0) {
      logWorldNews(memoryStale.articles, "stale");
      return memoryStale.articles.map(gdeltArticleToWorldResult);
    }

    const stale = await readCache(true);
    if (stale && stale.articles.length > 0) {
      writeMemory(stale.articles);
      logWorldNews(stale.articles, "stale");
      return stale.articles.map(gdeltArticleToWorldResult);
    }

    logWorldNews([], "miss");
    return [];
  } catch (error) {
    console.error("GDELT fetch error:", error);
    const memoryStale = readMemory(true);
    if (memoryStale && memoryStale.articles.length > 0) {
      logWorldNews(memoryStale.articles, "stale");
      return memoryStale.articles.map(gdeltArticleToWorldResult);
    }
    const stale = await readCache(true);
    if (stale && stale.articles.length > 0) {
      writeMemory(stale.articles);
      logWorldNews(stale.articles, "stale");
      return stale.articles.map(gdeltArticleToWorldResult);
    }
    logWorldNews([], "miss");
    return [];
  }
}

export async function getSharedWorldNews(): Promise<WorldSearchResult[]> {
  if (inflight) return inflight;
  inflight = loadSharedWorldNews().finally(() => {
    inflight = null;
  });
  return inflight;
}
