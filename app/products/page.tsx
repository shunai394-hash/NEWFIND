import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listDiscoveryProducts, listSeedDiscoveryProducts } from "@/lib/discovery/store";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryCategory } from "@/lib/discovery/types";
import { dedupeStorefrontProducts } from "@/lib/discovery/storefront-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "商品一覧｜ファッション・コスメ・暮らしのアイテム",
  description: "NEWFINDの商品一覧。ファッション、コスメ、バッグ、生活雑貨など、気になる商品をカテゴリやキーワードから探せます。",
};

const CATEGORIES: { key: DiscoveryCategory | "all"; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "fashion", label: "ファッション" },
  { key: "beauty", label: "コスメ・美容" },
  { key: "accessories", label: "バッグ・アクセサリー" },
  { key: "lifestyle", label: "ライフスタイル" },
  { key: "home", label: "ホーム・インテリア" },
  { key: "tech", label: "ガジェット" },
  { key: "food", label: "フード" },
  { key: "travel", label: "トラベル" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = CATEGORIES.some((item) => item.key === params.category) ? params.category : "all";
  const query = (params.q ?? "").trim().toLocaleLowerCase("ja-JP");
  let catalog;
  try {
    catalog = await listDiscoveryProducts({ admin: false, status: "approved" });
  } catch (error) {
    console.error("[STOREFRONT] product catalog unavailable; using approved seed fallback", error);
    catalog = listSeedDiscoveryProducts().filter((product) => product.status === "approved");
  }
  const products = dedupeStorefrontProducts(catalog.filter((product) => {
    if (!isUsableProductImage(product.productImageUrl)) return false;
    if (category !== "all" && product.category !== category) return false;
    if (!query) return true;
    return [product.brand, product.productName, product.description, product.subcategory]
      .some((value) => value.toLocaleLowerCase("ja-JP").includes(query));
  }));

  return (
    <main className="min-h-screen bg-[#fffdfa] text-neutral-900">
      <div className="relative overflow-hidden border-b border-neutral-200 bg-[#eee6dc] px-4 py-10 sm:px-8 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_90%_-20%,rgba(184,93,63,0.18),transparent_60%)]" />
        <div className="relative mx-auto max-w-[1440px]">
          <p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">NEWFIND ONLINE STORE</p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">商品一覧</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">ファッション、コスメ、暮らしの道具。気になる商品を見比べて、販売先の情報を確認できます。</p>
          <form action="/products" className="mt-6 flex max-w-xl gap-2">
            {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
            <label className="sr-only" htmlFor="product-search">商品を検索</label>
            <input id="product-search" name="q" defaultValue={params.q ?? ""} placeholder="商品名・ブランド・キーワードで検索" className="min-h-12 min-w-0 flex-1 rounded-full border border-neutral-300 bg-white px-5 text-sm outline-offset-2 focus:border-neutral-800" />
            <button className="min-h-12 rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white hover:bg-[#a6533a]" type="submit">検索</button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-12">
        <nav aria-label="商品カテゴリ" className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => {
            const active = item.key === category;
            const href = item.key === "all" ? "/products" : `/products?category=${item.key}`;
            return <Link key={item.key} href={href} aria-current={active ? "page" : undefined} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:border-neutral-900"}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="mt-8 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">{category === "all" ? "すべての商品" : CATEGORIES.find((item) => item.key === category)?.label}</h2>
          <p className="text-sm text-neutral-500">{products.length.toLocaleString("ja-JP")} 商品</p>
        </div>
        {products.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="mt-6 border border-neutral-200 bg-white px-5 py-16 text-center">
            <h3 className="text-lg font-semibold">該当する商品が見つかりませんでした</h3>
            <p className="mt-2 text-sm text-neutral-500">キーワードを変えるか、別のカテゴリをご覧ください。</p>
            <Link href="/products" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white">すべての商品を見る</Link>
          </div>
        )}
      </div>
    </main>
  );
}
