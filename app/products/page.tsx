import type { Metadata } from "next";
import { ProductDiscoverView } from "@/components/product-discover-view";

export const metadata: Metadata = {
  title: "商品を探す｜ファッション・美容・ガジェット",
  description:
    "ファッション、美容アイテム、ガジェットなど、気になる商品をNEWFINDで発見。商品情報や関連トレンドをチェックして、購入先を探せます。",
  alternates: {
    canonical: "/products",
  },
  openGraph: {
    title: "商品を探す｜ファッション・美容・ガジェット",
    description:
      "ファッション、美容アイテム、ガジェットなど、気になる商品をNEWFINDで発見。",
    url: "/products",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return <ProductDiscoverView />;
}
