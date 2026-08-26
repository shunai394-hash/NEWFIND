import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getCatalogProduct, listCatalogProducts } from "@/lib/products";

export function generateStaticParams() {
  return listCatalogProducts().map((product) => ({ id: product.id }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getCatalogProduct(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
