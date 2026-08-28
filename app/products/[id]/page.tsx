import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { isUsableProductImage } from "@/lib/discovery/media";
import { getDiscoveryProduct, listDiscoveryProducts } from "@/lib/discovery/store";

export const dynamic = "force-dynamic";

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
  return <ProductDetail product={product} related={related} />;
}
