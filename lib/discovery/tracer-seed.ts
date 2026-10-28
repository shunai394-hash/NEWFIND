import { normalizeBrand, normalizeProductName, sourceDomain } from "@/lib/discovery/normalize";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryCategory, DiscoveryProduct, DiscoveryProductInput } from "@/lib/discovery/types";

/**
 * TRACER seed — the owner's own store products (women's bags, hair
 * accessories, beauty accessories) listed on NEWFIND with purchase links to
 * the TRACER Shopify store.
 *
 * Added on 2026-10-28, replacing the previous third-party brand products
 * whose purchase links sent buyers to other companies' stores, so NEWFIND
 * earned nothing from them. Specs are fetched live from the store's public
 * products.json, so the seed always mirrors the current storefront catalog.
 *
 * Unlike the editorial Japan seed, each sale carries affiliateUrl = the
 * TRACER product page, because lib/discovery/shop.ts only exposes an
 * attributable destination as the storefront purchase CTA — and TRACER is
 * the revenue channel for NEWFIND.
 */

const NOW = "2026-10-28T00:00:00.000Z";
const SHOP_BASE = "https://ieufrg-tb.myshopify.com";
const SHOP_PRODUCTS_URL = `${SHOP_BASE}/products/`;

export type TracerSeedSpec = {
  id: string;
  productName: string;
  category: DiscoveryCategory;
  subcategory: string;
  description: string;
  price: number;
  imageUrl: string;
  handle: string;
};

function classify(title: string): { category: DiscoveryCategory; subcategory: string } {
  if (/バッグ|リュック|トート|ポーチ|クラッチ|ショルダー|サコッシュ|ボストン/.test(title)) {
    return { category: "accessories", subcategory: "Bag" };
  }
  if (/ヘア|髪|シュシュ|カチューシャ|バレッタ|バンスクリップ|シャーククリップ/.test(title)) {
    return { category: "accessories", subcategory: "Hair accessory" };
  }
  if (/ネックレス|ピアス|イヤリング|ブレスレット|指輪|リング|アンクレット/.test(title)) {
    return { category: "accessories", subcategory: "Jewelry" };
  }
  if (/コスメ|メイク|化粧|スキンケア|パック|美容液/.test(title)) {
    return { category: "beauty", subcategory: "Beauty goods" };
  }
  return { category: "accessories", subcategory: "Accessory" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(html: string, fallback: string): string {
  const text = stripHtml(html).split(/送料(込み|無料)/)[0]?.trim() ?? "";
  return (text || fallback).slice(0, 110);
}

type ShopifyProductsJson = {
  products: Array<{
    title: string;
    handle: string;
    body_html: string;
    variants: Array<{ price: string }>;
    images: Array<{ src: string }>;
  }>;
};

/** Fetch every published product from the TRACER storefront (products.json). */
export async function fetchTracerSeedSpecs(): Promise<TracerSeedSpec[]> {
  const specs: TracerSeedSpec[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(`${SHOP_BASE}/products.json?limit=250&page=${page}`, {
      headers: { "user-agent": "NEWFIND tracer seed" },
    });
    if (!res.ok) throw new Error(`products.json page ${page}: HTTP ${res.status}`);
    const data = (await res.json()) as ShopifyProductsJson;
    if (!data.products || data.products.length === 0) break;
    for (const product of data.products) {
      const imageUrl = product.images?.[0]?.src ?? "";
      const price = Number(product.variants?.[0]?.price ?? 0);
      if (!imageUrl || !Number.isFinite(price) || price <= 0) continue;
      const cjId = product.handle.split("-")[1] ?? product.handle;
      const { category, subcategory } = classify(product.title);
      specs.push({
        id: `tracer-${cjId}`,
        productName: product.title,
        category,
        subcategory,
        description: cleanDescription(product.body_html ?? "", product.title),
        price: Math.round(price),
        imageUrl,
        handle: product.handle,
      });
    }
    if (data.products.length < 250) break;
  }
  return specs;
}

export function tracerSeedProduct(spec: TracerSeedSpec): DiscoveryProductInput {
  const image = isUsableProductImage(spec.imageUrl) ? spec.imageUrl : null;
  const url = `${SHOP_PRODUCTS_URL}${spec.handle}`;
  return {
    id: spec.id,
    brand: "TRACER",
    productName: spec.productName,
    category: spec.category,
    subcategory: spec.subcategory,
    country: "Japan",
    description: spec.description,
    productImageUrl: image,
    productUrl: url,
    officialUrl: url,
    price: spec.price,
    currency: "JPY",
    sku: spec.handle,
    trendScore: 0,
    confidenceScore: image ? 80 : 50,
    discoverySource: "editorial",
    discoveredAt: NOW,
    attentionReason: image ? "TRACER ONLINE STOREに現行商品として掲載されています。" : "",
    status: image ? "approved" : "pending",
    trendTags: [],
    sources: [
      {
        id: `${spec.id}-src-1`,
        sourceType: "brand_official",
        sourceUrl: url,
        sourceTitle: `TRACER ${spec.productName}`,
        sourceDomain: sourceDomain(url),
        publishedAt: null,
        sourceExcerpt: spec.description,
        verificationStatus: "verified",
        sourceTier: 1,
        createdAt: NOW,
      },
    ],
    people: [],
    sales: [
      {
        id: `${spec.id}-sale-1`,
        sellerName: "TRACER ONLINE STORE",
        productUrl: url,
        price: spec.price,
        currency: "JPY",
        availability: "in_stock",
        officialStore: true,
        sellerKind: "official",
        affiliateUrl: url,
        lastVerifiedAt: NOW,
        createdAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function tracerSeedToDiscovery(spec: TracerSeedSpec): DiscoveryProduct {
  const input = tracerSeedProduct(spec);
  return {
    ...input,
    normalizedBrand: normalizeBrand(input.brand),
    normalizedProductName: normalizeProductName(input.productName),
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
  };
}

export async function buildTracerSeedProducts(): Promise<DiscoveryProductInput[]> {
  const specs = await fetchTracerSeedSpecs();
  return specs.map(tracerSeedProduct);
}
