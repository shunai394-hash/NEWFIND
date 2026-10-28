import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { discoveryShopUrl } from "@/lib/discovery/shop";
import type { DiscoveryProduct } from "@/lib/discovery/types";

const CATEGORIES = [
  { key: "fashion", label: "ファッション", note: "毎日に似合うスタイル" },
  { key: "beauty", label: "コスメ・美容", note: "自分らしいケアを" },
  { key: "accessories", label: "バッグ・アクセサリー", note: "装いの仕上げに" },
  { key: "lifestyle", label: "暮らしのアイテム", note: "毎日をもっと快適に" },
  { key: "home", label: "ホーム・インテリア", note: "心地よい空間づくり" },
  { key: "tech", label: "ガジェット", note: "便利なアイテムを探す" },
] as const;

const MARQUEE_WORDS = [
  "NEWFIND ONLINE STORE",
  "ファッション",
  "コスメ・美容",
  "バッグ・アクセサリー",
  "暮らしのアイテム",
  "ホーム・インテリア",
  "ガジェット",
];

function displayPrice(product: DiscoveryProduct): string | null {
  const selling = product.commercial?.sellingPriceJPY;
  if (selling != null && Number.isFinite(selling) && selling > 0) {
    return `¥${selling.toLocaleString("ja-JP")}`;
  }
  if (product.price != null && Number.isFinite(product.price) && product.price > 0) {
    return `¥${product.price.toLocaleString("ja-JP")}`;
  }
  return null;
}

function HeroCard({
  product,
  className,
  imgClassName,
}: {
  product: DiscoveryProduct;
  className: string;
  imgClassName: string;
}) {
  const price = displayPrice(product);
  return (
    <Link
      href={`/products/${product.id}`}
      className={`group relative block overflow-hidden bg-[#e4ddd4] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.productImageUrl ?? ""}
        alt={`${product.brand} ${product.productName}`}
        className={`w-full object-cover transition duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none ${imgClassName}`}
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 bg-white/92 px-3 py-2 shadow-sm backdrop-blur-sm">
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {product.brand}
          </span>
          <span className="block truncate text-xs font-semibold text-neutral-900">{product.productName}</span>
        </span>
        {price ? <span className="shrink-0 text-sm font-bold text-[#a6533a]">{price}</span> : null}
      </div>
    </Link>
  );
}

export function StorefrontHome({ products }: { products: DiscoveryProduct[] }) {
  const newProducts = [...products].sort((a, b) =>
    (b.discoveredAt ?? b.createdAt ?? "").localeCompare(a.discoveredAt ?? a.createdAt ?? ""),
  );
  const featured = products.slice(0, 4);
  const heroProducts = featured.slice(0, 3);
  const pickup =
    products.find((product) => product.trendTags?.includes("editorial_pick")) ?? featured[0] ?? null;
  const pickupShopUrl = pickup ? discoveryShopUrl(pickup) : null;
  const ranking = [...products]
    .sort((a, b) => {
      const score = (product: DiscoveryProduct) =>
        (product.trendTags?.includes("best_seller") ? 2 : 0) +
        (product.trendTags?.includes("editorial_pick") ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 5);
  const categoryImages = new Map<string, DiscoveryProduct>();
  for (const category of CATEGORIES) {
    const found = products.find(
      (product) => product.category === category.key && product.productImageUrl,
    );
    if (found) categoryImages.set(category.key, found);
  }
  const marqueeText = MARQUEE_WORDS.join("　◆　") + "　◆　";

  return (
    <div className="min-h-screen bg-[#fffdfa] text-[#20201e]">
      <div className="nf-marquee overflow-hidden bg-[#20201e] text-white" aria-label="NEWFIND オンラインストア取扱カテゴリー">
        <div className="nf-marquee-track flex w-max whitespace-nowrap py-2 text-[11px] font-semibold tracking-[0.22em]">
          <span>{marqueeText.repeat(3)}</span>
          <span aria-hidden="true">{marqueeText.repeat(3)}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-[#fffdfa]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="font-display text-3xl font-bold tracking-tight">
            NEWFIND<span className="text-[#b85d3f]">.</span>
          </Link>
          <nav aria-label="商品ナビゲーション" className="order-3 flex w-full items-center gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto sm:gap-7">
            <Link href="/products" className="whitespace-nowrap hover:text-[#a64f35]">すべての商品</Link>
            <a href="#categories" className="whitespace-nowrap hover:text-[#a64f35]">カテゴリー</a>
            <a href="#ranking" className="whitespace-nowrap hover:text-[#a64f35]">ランキング</a>
            <a href="#new-arrivals" className="whitespace-nowrap hover:text-[#a64f35]">新着商品</a>
          </nav>
          <Link href="/products" className="rounded-full bg-[#20201e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a6533a]">
            商品を探す　⌕
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#eee6dc]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_520px_at_85%_-10%,rgba(184,93,63,0.20),transparent_60%),radial-gradient(800px_480px_at_-10%_110%,rgba(32,32,30,0.10),transparent_55%)]"
          />
          <p
            aria-hidden="true"
            className="font-display pointer-events-none absolute right-4 top-8 hidden select-none text-sm font-semibold tracking-[0.5em] text-[#20201e]/35 [writing-mode:vertical-rl] lg:block"
          >
            世界のいいものを、あなたの日常へ
          </p>
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-24">
            <div className="max-w-2xl">
              <p className="nf-rise text-xs font-bold tracking-[0.22em] text-[#9c4c35] sm:text-sm">
                CURATED FOR EVERYDAY LIFE
              </p>
              <h1 className="nf-rise nf-rise-1 font-display mt-5 text-[42px] font-semibold leading-[1.14] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
                毎日に、<br />まだ知らない<br />
                <span className="text-[#a6533a]">お気に入りを。</span>
              </h1>
              <p className="nf-rise nf-rise-2 mt-6 max-w-lg text-sm leading-8 text-neutral-700 sm:text-base">
                ファッション、コスメ、暮らしの道具。世界から見つけた気になるアイテムを、商品情報を確かめながら選べるオンラインストア。
              </p>
              <div className="nf-rise nf-rise-3 mt-8 flex flex-wrap items-center gap-3">
                <Link href="/products" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#20201e] px-7 text-sm font-semibold text-white transition hover:bg-[#a6533a]">
                  商品を見てみる <span className="ml-3">→</span>
                </Link>
                <a href="#ranking" className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-500/50 px-7 text-sm font-semibold transition hover:bg-white/60">
                  注目のランキング
                </a>
                {products.length ? (
                  <span className="text-xs font-semibold tracking-wide text-neutral-600">
                    掲載アイテム <span className="font-display text-xl font-bold text-[#20201e]">{products.length.toLocaleString("ja-JP")}</span> 点
                  </span>
                ) : null}
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 sm:text-sm">
                <span>✓ 商品情報を確認して選べる</span>
                <span>✓ 気になる商品を比較</span>
                <span>✓ 販売先へスムーズに移動</span>
              </div>
            </div>
            <div className="nf-rise nf-rise-2 grid grid-cols-2 gap-3 sm:gap-5">
              {heroProducts[0] ? (
                <HeroCard product={heroProducts[0]} className="mt-10" imgClassName="aspect-[4/5] h-full" />
              ) : null}
              {heroProducts[1] ? (
                <HeroCard product={heroProducts[1]} className="" imgClassName="aspect-[4/5] h-full" />
              ) : null}
              {heroProducts[2] ? (
                <HeroCard product={heroProducts[2]} className="col-span-2" imgClassName="aspect-[16/8] h-full" />
              ) : null}
              {heroProducts.length === 0 ? (
                <div className="col-span-2 flex min-h-64 items-center justify-center bg-white p-8 text-center text-sm text-neutral-500">
                  商品を準備しています。新しい商品が公開されると、こちらに表示されます。
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {pickup ? (
          <section className="bg-[#20201e] text-white">
            <div className="mx-auto grid max-w-[1440px] items-stretch gap-0 lg:grid-cols-2">
              <Link href={`/products/${pickup.id}`} className="group relative block min-h-72 overflow-hidden bg-[#2a2a27]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pickup.productImageUrl ?? ""}
                  alt={`${pickup.brand} ${pickup.productName}`}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:py-20">
                <p className="text-xs font-bold tracking-[0.24em] text-[#e2a58c]">PICK UP — 編集部のおすすめ</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{pickup.brand}</p>
                <h2 className="font-display mt-2 text-3xl font-semibold leading-snug sm:text-4xl">
                  {pickup.productName}
                </h2>
                {pickup.description ? (
                  <p className="mt-4 line-clamp-4 max-w-xl text-sm leading-8 text-neutral-300">{pickup.description}</p>
                ) : null}
                {displayPrice(pickup) ? (
                  <p className="font-display mt-6 text-3xl font-bold">
                    {displayPrice(pickup)}
                    <span className="ml-2 align-middle text-xs font-normal text-neutral-400">
                      {pickup.commercial?.sellingPriceJPY ? "NEWFIND販売価格" : "販売先の参考価格"}
                    </span>
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/products/${pickup.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[#20201e] transition hover:bg-[#e9ddcb]">
                    商品詳細を見る <span className="ml-3">→</span>
                  </Link>
                  {pickupShopUrl ? (
                    <a href={pickupShopUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-7 text-sm font-semibold transition hover:border-white hover:bg-white/10">
                      販売先で購入する <span className="ml-3">↗</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section id="categories" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">SHOP BY CATEGORY</p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">カテゴリーから探す</h2>
            </div>
            <Link href="/products" className="text-sm font-semibold underline underline-offset-4">すべての商品を見る →</Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {CATEGORIES.map((category, index) => {
              const imageProduct = categoryImages.get(category.key);
              return (
                <Link
                  key={category.key}
                  href={`/products?category=${category.key}`}
                  className="group relative block overflow-hidden bg-[#20201e] text-white"
                >
                  {imageProduct ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageProduct.productImageUrl ?? ""}
                        alt=""
                        className="aspect-[4/5] w-full object-cover opacity-90 transition duration-700 ease-out group-hover:scale-105 group-hover:opacity-100 motion-reduce:transition-none sm:aspect-[3/4]"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden="true" />
                    </>
                  ) : (
                    <span className="block aspect-[4/5] bg-[#e9e2d6] sm:aspect-[3/4]" aria-hidden="true" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-4">
                    <span className={`block text-[10px] font-bold tracking-[0.14em] ${imageProduct ? "text-white/70" : "text-neutral-500"}`}>
                      0{index + 1}
                    </span>
                    <span className={`font-display mt-1 block text-base font-semibold sm:text-lg ${imageProduct ? "text-white" : "text-[#20201e]"}`}>
                      {category.label}
                    </span>
                    <span className={`mt-1 block text-[11px] leading-relaxed ${imageProduct ? "text-white/75" : "text-neutral-500"}`}>
                      {category.note}
                    </span>
                    <span className="mt-2 inline-block text-base transition group-hover:translate-x-1">↗</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {ranking.length ? (
          <section id="ranking" className="border-y border-neutral-200 bg-white px-4 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1440px]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">RANKING</p>
                  <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">注目アイテムランキング</h2>
                  <p className="mt-2 text-sm text-neutral-600">今チェックしたいアイテムを、編集部セレクトでご紹介。</p>
                </div>
                <Link href="/products" className="text-sm font-semibold underline underline-offset-4">商品一覧へ →</Link>
              </div>
              <ol className="mt-6 grid gap-x-10 lg:grid-cols-2">
                {ranking.map((product, index) => {
                  const price = displayPrice(product);
                  return (
                    <li key={product.id} className="border-b border-neutral-200">
                      <Link href={`/products/${product.id}`} className="group flex items-center gap-4 py-4 sm:gap-5">
                        <span
                          className={`font-display w-12 shrink-0 text-4xl font-bold leading-none sm:text-5xl ${
                            index === 0 ? "text-[#a6533a]" : "text-neutral-300"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="block h-20 w-16 shrink-0 overflow-hidden bg-[#f0ece6] sm:h-24 sm:w-20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.productImageUrl ?? ""}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{product.brand}</span>
                          <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug text-neutral-900 group-hover:underline underline-offset-2">
                            {product.productName}
                          </span>
                          {price ? <span className="mt-1 block text-sm font-bold text-[#20201e]">{price}</span> : null}
                        </span>
                        <span className="shrink-0 text-lg text-neutral-400 transition group-hover:translate-x-1 group-hover:text-[#a6533a]">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        ) : null}

        <section id="new-arrivals" className="bg-[#f5f1eb] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-[#a6533a]">JUST ARRIVED</p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">新着・注目アイテム</h2>
                <p className="mt-2 text-sm text-neutral-600">今チェックしたい商品をピックアップ。</p>
              </div>
              <Link href="/products" className="text-sm font-semibold underline underline-offset-4">商品一覧へ →</Link>
            </div>
            {newProducts.length ? (
              <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
                {newProducts.slice(0, 10).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-7 bg-white p-8 text-center text-sm text-neutral-500">現在、公開できる商品を準備しています。</div>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-12 sm:grid-cols-3 sm:px-8 sm:py-16">
          <div>
            <p className="font-display text-3xl font-bold text-[#a6533a]">01</p>
            <h3 className="mt-3 text-lg font-semibold">気になる商品を探す</h3>
            <p className="mt-2 text-sm leading-7 text-neutral-600">カテゴリーや商品一覧から、暮らしに合うアイテムを見つけます。</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-[#a6533a]">02</p>
            <h3 className="mt-3 text-lg font-semibold">仕様と販売先を確認</h3>
            <p className="mt-2 text-sm leading-7 text-neutral-600">掲載されている商品情報を確認し、販売先のページへ進めます。</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-[#a6533a]">03</p>
            <h3 className="mt-3 text-lg font-semibold">納得して選ぶ</h3>
            <p className="mt-2 text-sm leading-7 text-neutral-600">価格や条件は販売先の最新表示を確認してからご購入ください。</p>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden border-t border-neutral-200 bg-white">
        <div aria-hidden="true" className="font-display -mb-[3.5vw] select-none text-center text-[18.5vw] font-bold leading-[0.85] tracking-tight text-[#f0e9dc]">
          NEWFIND
        </div>
        <div className="relative px-5 py-8 text-sm text-neutral-500 sm:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-4">
            <Link href="/" className="font-display text-xl font-bold text-neutral-900">NEWFIND.</Link>
            <div className="flex gap-5">
              <Link href="/products">商品一覧</Link>
              <Link href="/login">ログイン</Link>
            </div>
            <p className="w-full text-xs">商品価格・在庫・配送条件は各販売先の最新情報をご確認ください。</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
