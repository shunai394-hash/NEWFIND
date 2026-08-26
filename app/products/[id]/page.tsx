import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getDiscoveryProduct, listDiscoveryProducts } from "@/lib/discovery/store";

export function generateStaticParams() {
  return listDiscoveryProducts({ admin: false, status: "approved" }).map((product) => ({
    id: product.id,
  }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getDiscoveryProduct(id, false);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
