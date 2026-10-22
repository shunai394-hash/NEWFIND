import type { MetadataRoute } from "next";
import { listDiscoveryProducts } from "@/lib/discovery/store";
import { isUsableProductImage } from "@/lib/discovery/media";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: new URL("/products", SITE_URL).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    // Use the same public, approved catalog as the product pages. The store
    // applies the public status/image filters; never expose pending or rejected
    // discovery records in the sitemap.
    const products = await listDiscoveryProducts({ admin: false, status: "approved" });
    const publicProducts = products.filter((product) =>
      product.status === "approved" && isUsableProductImage(product.productImageUrl),
    );

    entries.push(
      ...publicProducts.map((product) => {
        const modified = new Date(product.updatedAt || product.createdAt);
        return {
          url: new URL(`/products/${encodeURIComponent(product.id)}`, SITE_URL).toString(),
          lastModified: Number.isNaN(modified.getTime()) ? now : modified,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      }),
    );
  } catch (error) {
    // Keep the sitemap endpoint available if the catalog is temporarily
    // unavailable, while leaving a server-side diagnostic for operators.
    console.error("[SEO SITEMAP] public product listing failed", error);
  }

  return entries;
}
