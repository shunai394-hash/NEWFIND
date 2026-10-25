import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import type { DiscoveryProduct } from "@/lib/discovery/types";

const CATEGORIES = [
  { key: "fashion", label: "ファッション", note: "毎日に似合うスタイル" },
  { key: "beauty", label: "コスメ・美容", note: "自分らしいケアを" },
  { key: "accessories", label: "バッグ・アクセサリー", note: "装いの仕上げに" },
  { key: "lifestyle", label: "暮らしのアイテム", note: "毎日をもっと快適に" },
  { key: "home", label: "ホーム・インテリア", note: "心地よい空間づくり" },
  { key: "tech", label: "ガジェット", note: "便利なアイテムを探す" },
] as const;

export function StorefrontHome({ products }: { products: DiscoveryProduct[] }) {
  const newProducts = [...products].sort((a, b) =>
    (b.discoveredAt ?? b.createdAt ?? "").localeCompare(a.discoveredAt ?? a.createdAt ?? ""),
  );
  const featured = products.slice(0, 4);
  return (
    <div className="min-h-screen bg-[#fffdfa] text-[#20201e]">
      <div className="bg-[#20201e] px-4 py-2 text-center text-xs tracking-wide text-white sm:text-sm">
        NEWFIND — 世界のいいものを、あなたの日常へ。
      </div>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em] sm:text-3xl">NEWFIND<span className="text-[#b85d3f]">.</span></Link>
          <nav aria-label="商品ナビゲーション" className="order-3 flex w-full items-center gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto sm:gap-7">
            <Link href="/products" className="whitespace-nowrap hover:text-[#a64f35]">すべての商品</Link>
            <a href="#categories" className="whitespace-nowrap hover:text-[#a64f35]">カテゴリー</a>
            <a href="#new-arrivals" className="whitespace-nowrap hover:text-[#a64f35]">新着商品</a>
          </nav>
          <Link href="/products" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-neutral-900">商品を探す　⌕</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#eee6dc]">
          <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.22em] text-[#9c4c35] sm:text-sm">CURATED FOR EVERYDAY LIFE</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                毎日に、<br/>まだ知らない<br/><span className="text-[#a6533a]">お気に入りを。</span>
              </h1>
              <p className="mt-6 max-w-lg text-sm leading-8 text-neutral-700 sm:text-base">
                ファッション、コスメ、暮らしの道具。世界から見つけた気になるアイテムを、商品情報を確かめながら選べるオンラインストア。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/products" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#20201e] px-7 text-sm font-semibold text-white transition hover:bg-[#a6533a]">商品を見てみる <span className="ml-3">→</span></Link>
                <a href="#categories" className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-500/50 px-7 text-sm font-semibold hover:bg-white/60">カテゴリーから探す</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 sm:text-sm">
                <span>✓ 商品情報を確認して選べる</span><span>✓ 気になる商品を比較</span><span>✓ 販売先へスムーズに移動</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {featured.slice(0, 2).map((product, i) => (
                <Link key={product.id} href={`/products/${product.id}`} className={`group relative overflow-hidden bg-white ${i === 0 ? "mt-8" : ""}`}>
                  <div className="aspect-[4/5] overflow-hidden bg-[#e4ddd4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.productImageUrl ?? ""} alt={`${product.brand} ${product.productName}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wider text-neutral-500">{product.brand}</p><p className="mt-1 line-clamp-2 text-sm font-semibold">{product.productName}</p></div>
                </Link>
              ))}
              {featured.length === 0 ? <div className="col-span-2 flex min-h-64 items-center justify-center bg-white p-8 text-center text-sm text-neutral-500">商品を準備しています。新しい商品が公開されると、こちらに表示されます。</div> : null}
            </div>
          </div>
        </section>

        <section id="categories" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">SHOP BY CATEGORY</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">カテゴリーから探す</h2></div>
            <Link href="/products" className="text-sm font-semibold underline underline-offset-4">すべての商品を見る →</Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.map((category) => <Link key={category.key} href={`/products?category=${category.key}`} className="group flex min-h-32 flex-col justify-between border border-neutral-200 bg-white p-4 transition hover:border-[#a6533a] hover:bg-[#f8f1eb] sm:min-h-40 sm:p-5"><span className="text-[10px] font-bold tracking-[0.12em] text-neutral-400">0{CATEGORIES.findIndex((x) => x.key === category.key) + 1}</span><span><span className="block text-sm font-semibold sm:text-base">{category.label}</span><span className="mt-1 block text-xs leading-relaxed text-neutral-500">{category.note}</span></span><span className="self-end text-lg transition group-hover:translate-x-1">↗</span></Link>)}
          </div>
        </section>

        <section id="new-arrivals" className="bg-[#f5f1eb] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">JUST ARRIVED</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">新着・注目アイテム</h2><p className="mt-2 text-sm text-neutral-600">今チェックしたい商品をピックアップ。</p></div><Link href="/products" className="text-sm font-semibold underline underline-offset-4">商品一覧へ →</Link></div>
            {newProducts.length ? <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">{newProducts.slice(0, 10).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-7 bg-white p-8 text-center text-sm text-neutral-500">現在、公開できる商品を準備しています。</div>}
          </div>
        </section>
        <section className="mx-auto grid max-w-[1440px] gap-6 px-5 py-12 sm:grid-cols-3 sm:px-8 sm:py-16">
          <div><p className="text-xs font-bold tracking-[0.18em] text-[#a6533a]">01 / FIND</p><h3 className="mt-3 text-lg font-semibold">気になる商品を探す</h3><p className="mt-2 text-sm leading-7 text-neutral-600">カテゴリーや商品一覧から、暮らしに合うアイテムを見つけます。</p></div>
          <div><p className="text-xs font-bold tracking-[0.18em] text-[#a6533a]">02 / CHECK</p><h3 className="mt-3 text-lg font-semibold">仕様と販売先を確認</h3><p className="mt-2 text-sm leading-7 text-neutral-600">掲載されている商品情報を確認し、販売先のページへ進めます。</p></div>
          <div><p className="text-xs font-bold tracking-[0.18em] text-[#a6533a]">03 / CHOOSE</p><h3 className="mt-3 text-lg font-semibold">納得して選ぶ</h3><p className="mt-2 text-sm leading-7 text-neutral-600">価格や条件は販売先の最新表示を確認してからご購入ください。</p></div>
        </section>
      </main>
      <footer className="border-t border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-500 sm:px-8"><div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-4"><Link href="/" className="font-bold tracking-tight text-neutral-900">NEWFIND.</Link><div className="flex gap-5"><Link href="/products">商品一覧</Link><Link href="/login">ログイン</Link></div><p className="w-full text-xs">商品価格・在庫・配送条件は各販売先の最新情報をご確認ください。</p></div></footer>
    </div>
  );
}
