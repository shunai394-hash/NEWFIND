"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { authHeaders } from "@/lib/auth/client-headers";
import type { AppNotification } from "@/lib/discovery/alerts";

export function NotificationsView() {
  const router = useRouter();
  const { ready, sessionResolved, session } = useApp();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    if (!session) {
      router.replace("/login?next=/notifications");
      return;
    }
    let cancelled = false;
    authHeaders()
      .then((headers) => fetch("/api/notifications", { cache: "no-store", headers }))
      .then(async (response) => {
        if (!response.ok) return { notifications: [] };
        return response.json();
      })
      .then((body) => {
        if (cancelled) return;
        setItems((body.notifications ?? []) as AppNotification[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session, router]);

  if (!ready || !sessionResolved || loading) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!session) return null;

  return (
    <div className="bg-white">
      <h1 className="px-4 py-3 text-sm font-semibold">通知 / アラーム</h1>
      {items.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-neutral-500">
          まだ通知はありません。いいね、フォロー、コメント、保存した商品のトレンド上昇がここに表示されます。
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const href = item.productId
              ? `/products/${item.productId}`
              : item.postId
                ? `/p/${item.postId}`
                : null;
            const unread = !item.readAt;
            const content = (
              <div className="px-4 py-3">
                <p className={`text-sm ${unread ? "font-semibold" : ""}`}>{item.title}</p>
                {item.body ? <p className="mt-1 text-xs text-neutral-500">{item.body}</p> : null}
              </div>
            );
            return (
              <li key={item.id}>
                {href ? (
                  <Link href={href} onClick={() => void markRead(item.id)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => void markRead(item.id)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function markRead(id: string) {
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ id }),
    });
  } catch {
    // ignore
  }
}
