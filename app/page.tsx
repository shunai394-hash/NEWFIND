import type { Metadata } from "next";
import { StorefrontHome } from "@/components/storefront-home";
import { listDiscoveryProducts, listSeedDiscoveryProducts } from "@/lib/discovery/store";
import { isUsableProductImage } from "@/lib/discovery/media";

const storeTitle = "NEWFIND｜ファッション・コスメ・暮らしのオンラインストア";
const storeDescription =
  "ファッション、コスメ、バッグ、暮らしの道具を探せるオンラインストア。商品情報や販売先を確認して、毎日に合うお気に入りを見つけよう。";

export const metadata: Metadata = {
  title: storeTitle,
  description: storeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "NEWFIND",
    title: storeTitle,
    description: storeDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: storeTitle,
    description: storeDescription,
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let allProducts;
  try {
    allProducts = await listDiscoveryProducts({ admin: false, status: "approved" });
  } catch (error) {
    console.error("[STOREFRONT] live catalog unavailable; using approved seed fallback", error);
    allProducts = listSeedDiscoveryProducts().filter((product) => product.status === "approved");
  }
  const products = allProducts.filter(
    (product) => product.status === "approved" && isUsableProductImage(product.productImageUrl),
  );
  return <StorefrontHome products={products} />;
}
