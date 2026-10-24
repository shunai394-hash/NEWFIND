import { ProductDiscoverView } from "@/components/product-discover-view";
import { DISCOVERY_CATEGORIES, type DiscoveryCategory } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const initialCategory = DISCOVERY_CATEGORIES.includes(category as DiscoveryCategory)
    ? (category as DiscoveryCategory)
    : "all";
  return <ProductDiscoverView initialCategory={initialCategory} />;
}
