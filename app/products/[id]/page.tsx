import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { isUsableProductImage } from "@/lib/discovery/media";
import {
  getDiscoveryProduct,
  listDiscoveryProducts,
  listSeedDiscoveryProducts,
} from "@/lib/discovery/store";
import { loadMarketplaceDossier } from "@/lib/marketplace/store";
import type { DiscoveryProduct } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

function productMetadataText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

async function getStorefrontProduct(id: string): Promise<DiscoveryProduct | null> {
  try {
    const liveProduct = await getDiscoveryProduct(id, false);
    if (liveProduct) return liveProduct;
  } catch (error) {
    console.error("[STOREFRONT] live product detail unavailable; trying approved seed catalog", error);
  }
  return listSeedDiscoveryProducts().find((item) => item.id === id && item.status === "approved") ?? null;
}

async function getStorefrontCatalog(): Promise<DiscoveryProduct[]> {
  try {
    return await listDiscoveryProducts({ admin: false, status: "approved" });
  } catch (error) {
    console.error("[STOREFRONT] related product catalog unavailable; using approved seed catalog", error);
    return listSeedDiscoveryProducts().filter((item) => item.status === "approved");
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getStorefrontProduct(id);
  if (!product || !isUsableProductImage(product.productImageUrl)) {
    return {
      title: "商品情報が見つかりません",
      robots: { index: false, follow: false },
    };
  }

  const productName = productMetadataText(product.productName, 55);
  const brand = productMetadataText(product.brand, 30);
  const title = productMetadataText([brand, productName].filter(Boolean).join(" "), 60);
  const description = productMetadataText(
    [
      product.description,
      product.subcategory ? `カテゴリ：${product.subcategory}` : "",
      product.price != null ? `価格：${product.price.toLocaleString("ja-JP")} ${product.currency}` : "",
      "商品詳細・価格・販売先を確認できます。",
    ].filter(Boolean).join(" "),
    155,
  );
  const canonicalPath = `/products/${encodeURIComponent(product.id)}`;
  const image = product.productImageUrl || undefined;

  return {
    title: `${title}｜商品詳細・販売先`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "ja_JP",
      siteName: "NEWFIND",
      title: `${title}｜商品詳細・販売先`,
      description,
      url: canonicalPath,
      images: image ? [{ url: image, alt: `${brand} ${productName}`.trim() }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${title}｜商品詳細・販売先`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getStorefrontProduct(id);
  if (!product || !isUsableProductImage(product.productImageUrl)) notFound();

  const related = (await getStorefrontCatalog())
    .filter((item) => item.id !== product.id)
    .filter((item) => isUsableProductImage(item.productImageUrl))
    .filter(
      (item) =>
        item.category === product.category ||
        item.people.some((person) =>
          product.people.some((mine) => mine.personName === person.personName),
        ),
    )
    .slice(0, 6);

  let marketplace: unknown = undefined;
  try {
    marketplace = await loadMarketplaceDossier({ discoveryProductId: product.id });
  } catch (error) {
    console.error("[STOREFRONT] optional marketplace detail unavailable", error);
  }

  const productUrl = new URL(
    `/products/${encodeURIComponent(product.id)}`,
    process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app",
  ).toString();
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: [product.brand, product.productName].filter(Boolean).join(" ").trim(),
    description: productMetadataText(product.description, 500) || undefined,
    image: product.productImageUrl,
    category: product.subcategory || product.category || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    url: productUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail product={product} related={related} marketplace={marketplace} />
    </>
  );
}
