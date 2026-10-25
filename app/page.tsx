import type { Metadata } from "next";
import { StorefrontHome } from "@/components/storefront-home";
import { listDiscoveryProducts } from "@/lib/discovery/store";
import { isUsableProductImage } from "@/lib/discovery/media";

export const metadata: Metadata = {
  title: "NEWFIND｜ファッション・コスメ・暮らしのオンラインストア",
  description: "ファッション、コスメ、バッグ、暮らしの道具を探せるオンラインストア。商品情報と販売先を確認して、毎日に合うお気に入りを見つけよう。",
};

export const revalidate = 60;

export default async function HomePage() {
  const allProducts = await listDiscoveryProducts({ admin: false, status: "approved" });
  const products = allProducts.filter((product) => isUsableProductImage(product.productImageUrl));
  return <StorefrontHome products={products} />;
}
