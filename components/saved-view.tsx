"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { ProductCard } from "@/components/product-card";
import { useApp } from "@/lib/app-context";
import { fetchSavedProducts, fetchUserAlerts, patchUserAlert } from "@/lib/discovery/client-api";
import { isUsableProductImage } from "@/lib/discovery/media";
import { hasDisplayablePostMedia } from "@/lib/products/discovery-filter";
import { ALERT_TYPE_LABELS, type AlertType } from "@/lib/discovery/types";
import { getStore } from "@/lib/store";
import type { DiscoveryProduct } from "@/lib/discovery/types";
import type { PostView } from "@/lib/types";

type SavedTab = "posts" | "products";

export function SavedView() {
  const router = useRouter();
  const { ready, sessionResolved, session } = useApp();
  const [tab, setTab] = useState<SavedTab>("products");
  const [posts, setPosts] = useState<PostView[]>([]);
  const [products, setProducts] = useState<DiscoveryProduct[]>([]);
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      alertType: string;
      productId: string | null;
      brand: string | null;
      isEnabled: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    if (!session) {
      router.replace("/login?next=/saved");
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStore().getSaved(session.userId),
      fetchSavedProducts().catch(() => ({ products: [] as DiscoveryProduct[] })),
      fetchUserAlerts().catch(() => []),
    ])
      .then(([savedPosts, savedProducts, userAlerts]) => {
        if (cancelled) return;
        setPosts(savedPosts.filter(hasDisplayablePostMedia));
        setProducts(savedProducts.products.filter((item) => isUsableProductImage(item.productImageUrl)));
        setAlerts(userAlerts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session, router]);

  if (!ready || !sessionResolved) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!session) return null;

  return (
    <div>
      <h1 className="bg-white px-4 py-3 text-sm font-semibold">保存済み</h1>
      <div className="grid grid-cols-2 border-b border-neutral-200 bg-white text-sm font-semibold">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`min-h-11 py-3 ${tab === "products" ? "border-b-2 border-[#C6FF00]" : "text-neutral-400"}`}
        >
          商品
        </button>
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`min-h-11 py-3 ${tab === "posts" ? "border-b-2 border-[#C6FF00]" : "text-neutral-400"}`}
        >
          投稿
        </button>
      </div>
      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>
      ) : tab === "products" ? (
        products.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-neutral-500">保存した商品はまだありません</p>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-px bg-neutral-200">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onUnsave={(id) => setProducts((prev) => prev.filter((item) => item.id !== id))}
              />
            ))}
          </div>
          {alerts.length > 0 ? (
            <section className="border-t border-neutral-200 px-4 py-4">
              <h2 className="text-sm font-semibold">通知 / アラーム</h2>
              <p className="mt-1 text-xs text-neutral-500">
                保存した商品のトレンド上昇や、同じブランドの新商品に備える設定です。自動通知の配信はまだ開始していません。
              </p>
              <ul className="mt-3 space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
                    <span className="text-sm">
                      {ALERT_TYPE_LABELS[alert.alertType as AlertType] ?? alert.alertType}
                      {alert.brand ? ` · ${alert.brand}` : ""}
                    </span>
                    <button
                      type="button"
                      className="touch-manipulation text-xs font-semibold"
                      onClick={async () => {
                        const next = !alert.isEnabled;
                        await patchUserAlert(alert.id, next).catch(() => null);
                        setAlerts((prev) =>
                          prev.map((item) =>
                            item.id === alert.id ? { ...item, isEnabled: next } : item,
                          ),
                        );
                      }}
                    >
                      {alert.isEnabled ? "ON" : "OFF"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          </>
        )
      ) : posts.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-500">保存した投稿はまだありません</p>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDeleted={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
            onUnavailable={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
          />
        ))
      )}
    </div>
  );
}
