import { isUsableProductImage } from "@/lib/discovery/media";

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "NEWFIND/1.0 (product-discovery; world-search)";
const MAX_HTML_BYTES = 750_000;

const REJECTED_IMAGE_HOSTS = [
  "unsplash.com",
  "images.unsplash.com",
  "pexels.com",
  "images.pexels.com",
  "pixabay.com",
  "placehold.co",
  "placeholder.com",
  "gravatar.com",
];

const REJECTED_IMAGE_PATH =
  /logo|favicon|sprite|avatar|icon[-_/]|\/icons?\/|badge|banner|pixel|tracking|1x1|spacer/i;

const PRODUCT_IMG_HINT =
  /product|pdp|gallery|hero|main[-_]?image|item[-_]?image|goods|sku|media|zoom|featured/i;

const GENERIC_IMAGE_HINT =
  /social|share|og[-_]?image|twitter|facebook|instagram|linkedin|banner|masthead/i;

export function isAssetOrNonProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const haystack = `${host}${path}`;

    if (
      /\.(jpg|jpeg|png|webp|gif|svg|css|js|mjs|woff2?|ttf|ico|mp4|webm)(\?|$)/i.test(
        path,
      )
    ) {
      return true;
    }

    if (
      /\/(cdn|assets|static|images|img|media|stencil|thumbnails?|uploads?)\b/i.test(
        path,
      )
    ) {
      return true;
    }

    if (
      /^cdn\d*\./i.test(host) ||
      host.startsWith("images.") ||
      host.startsWith("img.") ||
      host.includes("shopifycdn.com") ||
      host.includes("cloudinary.com") ||
      host.includes("bigcommerce.com")
    ) {
      return true;
    }

    if (
      host.includes("play.google.com") ||
      host.includes("apps.apple.com") ||
      host.includes("freelancer.") ||
      host.includes("templatemonster.com") ||
      host.includes("couponzania.com")
    ) {
      return true;
    }

    if (/\/store\/apps\//i.test(path)) return true;
    if (haystack.includes("/cdn/shop/")) return true;
    if (path.includes("products-in-image")) return true;

    if (/\/p\/[^/?#]*(terms|privacy|policy|cookie|legal)/i.test(path)) {
      return true;
    }

    if (
      host === "imall.com" ||
      host.endsWith(".imall.com") ||
      host.includes("made-in-china.com") ||
      host.includes("poshmark.com")
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

export function isStoreOrBrandHomepage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";

    if (path === "/") return true;
    if (/^\/(index|home)$/i.test(path)) return true;

    if (
      /^\/(en|ja|jp|us|uk|de|fr|es|it|kr|ko|zh|cn|tw|eu)(-[a-z]{2})?$/i.test(
        path,
      )
    ) {
      return true;
    }

    if (
      /^\/(en|ja|jp|us|uk|de|fr|es|it|kr|ko|zh|cn|tw)\/(home)?$/i.test(path)
    ) {
      return true;
    }

    if (/^\/(shop|store|stores|products?)$/i.test(path)) return true;

    return false;
  } catch {
    return false;
  }
}

export function isAcceptableProductPageImage(
  url: string | null | undefined,
): boolean {
  if (!url || !isUsableProductImage(url)) return false;

  const value = url.trim();

  if (!/^https?:\/\//i.test(value)) return false;

  let hostname = "";
  let pathname = "";

  try {
    const parsed = new URL(value);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return false;
  }

  if (
    REJECTED_IMAGE_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  ) {
    return false;
  }

  if (REJECTED_IMAGE_PATH.test(`${pathname} ${value}`)) return false;
  if (/\.svg(\?|$)/i.test(pathname)) return false;

  return true;
}

export async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";

    if (
      contentType &&
      !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
    ) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    const sliced =
      buffer.byteLength > MAX_HTML_BYTES
        ? buffer.slice(0, MAX_HTML_BYTES)
        : buffer;

    return new TextDecoder("utf-8", { fatal: false }).decode(sliced);
  } catch {
    return null;
  }
}

function resolveUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");

  if (!trimmed) return null;

  if (
    /^(javascript|mailto|tel|data):/i.test(trimmed) ||
    trimmed.startsWith("#")
  ) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    resolved.hash = "";

    return resolved.toString();
  } catch {
    return null;
  }
}

export function titleFromProductUrl(url: string, linkText = ""): string {
  const cleaned = linkText.replace(/\s+/g, " ").trim();

  if (
    cleaned &&
    cleaned.length >= 3 &&
    cleaned.length <= 120 &&
    !/^(shop now|buy now|learn more|view|here|click)$/i.test(cleaned)
  ) {
    return cleaned;
  }

  try {
    const slug = decodeURIComponent(
      new URL(url).pathname.split("/").filter(Boolean).pop() || "",
    );

    return slug.replace(/[-_]+/g, " ").trim() || url;
  } catch {
    return url;
  }
}

export function extractUrlsFromText(text: string, baseUrl: string): string[] {
  if (!text) return [];

  const found = new Set<string>();

  const push = (raw: string) => {
    const resolved = resolveUrl(raw.replace(/[),.;]+$/, ""), baseUrl);

    if (resolved) found.add(resolved);
  };

  for (const match of text.matchAll(
    /(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  )) {
    push(match[1]);
  }

  for (const match of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi)) {
    push(match[1]);
  }

  for (const match of text.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
    push(match[0]);
  }

  return [...found];
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCharCode(Number.parseInt(num, 10)),
    );
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`,
      "i",
    );

    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }

    const reverse = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`,
      "i",
    );

    const reverseMatch = html.match(reverse);

    if (reverseMatch?.[1]) {
      return decodeHtmlEntities(reverseMatch[1].trim());
    }
  }

  return null;
}

function collectImageLike(value: unknown, out: string[]) {
  if (!value) return;

  if (typeof value === "string") {
    out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageLike(item, out);
    }
    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.url === "string") out.push(record.url);
    if (typeof record.contentUrl === "string") out.push(record.contentUrl);

    if (typeof record.image === "string" || Array.isArray(record.image)) {
      collectImageLike(record.image, out);
    }
  }
}

function isProductJsonLdType(type: unknown): boolean {
  if (typeof type === "string") {
    return /(^|\/)product$/i.test(type);
  }

  if (Array.isArray(type)) {
    return type.some((item) => isProductJsonLdType(item));
  }

  return false;
}

function imagesFromJsonLd(html: string): string[] {
  const images: string[] = [];

  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const script of scripts) {
    const raw = script[1]?.trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;

      const graph =
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { "@graph"?: unknown })["@graph"])
          ? ((parsed as { "@graph": unknown[] })["@graph"] ?? [])
          : null;

      const nodes = Array.isArray(parsed)
        ? parsed
        : graph
          ? graph
          : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;

        const record = node as Record<string, unknown>;

        if (!isProductJsonLdType(record["@type"])) continue;

        collectImageLike(record.image, images);

        if (record.offers && typeof record.offers === "object") {
          collectImageLike(
            (record.offers as Record<string, unknown>).image,
            images,
          );
        }
      }
    } catch {
      // Ignore broken JSON-LD.
    }
  }

  return images;
}

function imagesFromProductSchema(html: string): string[] {
  const images: string[] = [];

  for (const match of html.matchAll(
    /itemprop=["']image["'][^>]*(?:content|src)=["']([^"']+)["']/gi,
  )) {
    if (match[1]) images.push(decodeHtmlEntities(match[1]));
  }

  for (const match of html.matchAll(
    /(?:content|src)=["']([^"']+)["'][^>]*itemprop=["']image["']/gi,
  )) {
    if (match[1]) images.push(decodeHtmlEntities(match[1]));
  }

  return images;
}

function imagesFromImageLink(html: string): string[] {
  const images: string[] = [];

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];

    const rel =
      tag.match(/\brel=["']([^"']+)["']/i)?.[1] ||
      "";

    if (!/(^|\s)image_src(\s|$)/i.test(rel)) continue;

    const href =
      tag.match(/\bhref=["']([^"']+)["']/i)?.[1] ||
      "";

    if (href) images.push(decodeHtmlEntities(href));
  }

  return images;
}

function parseSrcset(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function imagesFromProductPage(html: string): string[] {
  const images: string[] = [];

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];

    const attrs = tag;

    if (REJECTED_IMAGE_PATH.test(attrs)) continue;
    if (GENERIC_IMAGE_HINT.test(attrs)) continue;

    const srcValues = [
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1],
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1],
      tag.match(/\bdata-original=["']([^"']+)["']/i)?.[1],
    ].filter(Boolean) as string[];

    const srcsetValues = [
      tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1],
      tag.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1],
    ].filter(Boolean) as string[];

    for (const srcset of srcsetValues) {
      srcValues.push(...parseSrcset(srcset));
    }

    const isProductImage = PRODUCT_IMG_HINT.test(attrs);

    for (const src of srcValues) {
      if (!src) continue;

      if (isProductImage) {
        images.unshift(decodeHtmlEntities(src));
      } else {
        images.push(decodeHtmlEntities(src));
      }
    }
  }

  return images;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeCandidateImage(
  candidate: string,
  pageUrl: string,
): string | null {
  const resolved = resolveUrl(candidate, pageUrl);

  if (!resolved) return null;

  const upgraded =
    pageUrl.startsWith("https:") && resolved.startsWith("http:")
      ? `https:${resolved.slice("http:".length)}`
      : resolved;

  if (isAcceptableProductPageImage(upgraded)) {
    return upgraded;
  }

  if (isAcceptableProductPageImage(resolved)) {
    return resolved;
  }

  return null;
}

export function extractProductImageFromHtml(
  html: string,
  pageUrl: string,
): string | null {
  /*
   * IMPORTANT:
   * Never trust a generic social/OG image before product-specific
   * structured data. The product page itself is the source of truth.
   */

  const productCandidates = unique([
    ...imagesFromJsonLd(html),
    ...imagesFromProductSchema(html),
    ...imagesFromImageLink(html),
    ...imagesFromProductPage(html),
  ]);

  for (const candidate of productCandidates) {
    const normalized = normalizeCandidateImage(candidate, pageUrl);

    if (normalized) return normalized;
  }

  /*
   * OG/Twitter are only fallback sources.
   * They are intentionally checked after all product-specific sources.
   */
  const socialCandidates = unique([
    metaContent(html, ["og:image", "og:image:url", "og:image:secure_url"]),
    metaContent(html, ["twitter:image", "twitter:image:src"]),
  ].filter(Boolean) as string[]);

  for (const candidate of socialCandidates) {
    const normalized = normalizeCandidateImage(candidate, pageUrl);

    if (normalized) return normalized;
  }

  return null;
}

export type ProductPageFacts = {
  brand: string | null;
  productName: string | null;
  description: string | null;
  sku: string | null;
  gtin: string | null;
  modelNumber: string | null;
  price: number | null;
  currency: string | null;
  launchDate: string | null;
  officialUrl: string | null;
  imageUrl: string | null;
};

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return record.name.trim();
    if (typeof record.brand === "string") return record.brand.trim();
  }
  return null;
}

function firstOffer(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const found = value.find((item) => item && typeof item === "object");
    return found ? (found as Record<string, unknown>) : null;
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function factsFromProductNode(record: Record<string, unknown>): ProductPageFacts {
  const offer = firstOffer(record.offers);
  const priceRaw = offer?.price ?? offer?.lowPrice ?? record.price;
  const price = Number(priceRaw);
  const gtin =
    textFromUnknown(record.gtin) ||
    textFromUnknown(record.gtin13) ||
    textFromUnknown(record.gtin12) ||
    textFromUnknown(record.gtin14) ||
    textFromUnknown(record.ean) ||
    null;
  const images: string[] = [];
  collectImageLike(record.image, images);
  return {
    brand: textFromUnknown(record.brand) || textFromUnknown(record.manufacturer),
    productName: textFromUnknown(record.name),
    description: textFromUnknown(record.description),
    sku: textFromUnknown(record.sku),
    gtin,
    modelNumber:
      textFromUnknown(record.model) || textFromUnknown(record.mpn) || null,
    price: Number.isFinite(price) ? price : null,
    currency:
      textFromUnknown(offer?.priceCurrency) ||
      textFromUnknown(record.priceCurrency),
    launchDate:
      textFromUnknown(record.releaseDate) ||
      textFromUnknown(record.datePublished) ||
      null,
    officialUrl: textFromUnknown(record.url),
    imageUrl: images[0] ?? null,
  };
}

function jsonLdProductNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    const raw = script[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const graph =
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { "@graph"?: unknown })["@graph"])
          ? ((parsed as { "@graph": unknown[] })["@graph"] ?? [])
          : null;
      const list = Array.isArray(parsed) ? parsed : graph ? graph : [parsed];
      for (const node of list) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        if (isProductJsonLdType(record["@type"])) nodes.push(record);
      }
    } catch {
      // Ignore broken JSON-LD.
    }
  }
  return nodes;
}

export function extractProductFactsFromHtml(
  html: string,
  pageUrl: string,
): ProductPageFacts {
  const fromLd = jsonLdProductNodes(html)[0];
  const facts = fromLd
    ? factsFromProductNode(fromLd)
    : {
        brand: null,
        productName: null,
        description: null,
        sku: null,
        gtin: null,
        modelNumber: null,
        price: null,
        currency: null,
        launchDate: null,
        officialUrl: null,
        imageUrl: null,
      };

  const sku =
    facts.sku ||
    metaContent(html, ["product:retailer_item_id", "sku", "product:sku"]);
  const priceMeta = metaContent(html, ["product:price:amount", "og:price:amount"]);
  const currencyMeta = metaContent(html, [
    "product:price:currency",
    "og:price:currency",
  ]);
  const imageUrl = facts.imageUrl || extractProductImageFromHtml(html, pageUrl);
  const price =
    facts.price ??
    (priceMeta && Number.isFinite(Number(priceMeta)) ? Number(priceMeta) : null);

  return {
    ...facts,
    sku,
    price,
    currency: facts.currency || currencyMeta,
    imageUrl,
    officialUrl: facts.officialUrl || pageUrl,
    productName:
      facts.productName ||
      metaContent(html, ["og:title", "twitter:title"]),
    description:
      facts.description ||
      metaContent(html, ["og:description", "description"]),
  };
}

export function productFactsAreSufficient(facts: ProductPageFacts) {
  const identity = Boolean(facts.sku || facts.gtin || facts.modelNumber);
  const priced = facts.price != null;
  const named = Boolean(facts.productName && facts.brand);
  const imaged = Boolean(facts.imageUrl);
  return imaged && named && (identity || priced || Boolean(facts.description));
}