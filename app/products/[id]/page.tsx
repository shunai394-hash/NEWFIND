import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { isUsableProductImage } from "@/lib/discovery/media";
import { getDiscoveryProduct, listDiscoveryProducts } from "@/lib/discovery/store";
import { loadMarketplaceDossier } from "@/lib/marketplace/store";

export const dynamic = "force-dynamic";

function productMetadataText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getDiscoveryProduct(id, false);
  if (!product || !isUsableProductImage(product.productImageUrl)) {
    return {
      title: "商品情報が見つかりません",
      robots: { index: false, follow: false },
    };
  }

  const productName = productMetadataText(product.productName, 55);
  const brand = productMetadataText(product.brand, 30);
  const title = productMetadataText(
    [brand, productName].filter(Boolean).join(" "),
    60,
  );
  const description = productMetadataText(
    [
      product.description,
      product.subcategory ? `カテゴリ：${product.subcategory}` : "",
      product.price != null
        ? `価格：${product.price.toLocaleString("ja-JP")} ${product.currency}`
        : "",
      "商品情報・トレンド・公式販売先を確認できます。",
    ]
      .filter(Boolean)
      .join(" "),
    155,
  );
  const canonicalPath = `/products/${encodeURIComponent(product.id)}`;
  const image = product.productImageUrl || undefined;

  return {
    title: `${title}｜商品情報・販売先`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "ja_JP",
      siteName: "NEWFIND",
      title: `${title}｜商品情報・販売先`,
      description,
      url: canonicalPath,
      images: image ? [{ url: image, alt: `${brand} ${productName}`.trim() }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${title}｜商品情報・販売先`,
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
  const product = await getDiscoveryProduct(id, false);
  if (!product || !isUsableProductImage(product.productImageUrl)) notFound();
  const related = (await listDiscoveryProducts({ admin: false, status: "approved" }))
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
  const marketplace = await loadMarketplaceDossier({ discoveryProductId: product.id });
  const productUrl = new URL(`/products/${encodeURIComponent(product.id)}`, process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app").toString();
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\\\u003c") }}
      />
      <ProductDetail product={product} related={related} marketplace={marketplace} />
    </>
  );
}
