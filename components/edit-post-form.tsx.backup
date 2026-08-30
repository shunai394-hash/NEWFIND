"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { POST_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { isHttpUrl } from "@/lib/media";
import { getStore } from "@/lib/store";
import { type CategoryId, type VisualKind } from "@/lib/types";

const VISUAL_OPTIONS: Array<{ id: VisualKind | ""; label: string }> = [
  { id: "", label: "ビジュアル（任意）" },
  { id: "model", label: "リアルなファッション" },
  { id: "product", label: "商品" },
  { id: "street", label: "ストリート" },
  { id: "lifestyle", label: "ライフスタイル" },
  { id: "illustration", label: "イラスト" },
  { id: "anime", label: "アニメ・カルチャー" },
  { id: "brand", label: "ブランドビジュアル" },
];

export function EditPostForm({ postId }: { postId: string }) {
  const router = useRouter();
  const { ready, sessionResolved, session } = useApp();

  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<CategoryId>("fashion");
  const [visualKind, setVisualKind] = useState<VisualKind | "">("");
  const [productUrl, setProductUrl] = useState("");
  const [productLabel, setProductLabel] = useState("商品を見る");
  const [preview, setPreview] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video">("photo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && sessionResolved && !session) {
      router.replace(`/login?next=/p/${encodeURIComponent(postId)}/edit`);
    }
  }, [ready, sessionResolved, session, router, postId]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    getStore()
      .getPost(postId, session.userId)
      .then((post) => {
        if (cancelled) return;

        if (!post) {
          setError("投稿が見つかりません");
          return;
        }

        if (post.authorId !== session.userId) {
          setError("この投稿は編集できません");
          return;
        }

        setCaption(post.caption);
        setCategory(post.category);
        setVisualKind(post.visualKind ?? "");
        setProductUrl(post.productUrl ?? "");
        setProductLabel(post.productLabel ?? "商品を見る");
        setPreview(post.mediaUrl);
        setMediaType(post.mediaType);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "読み込みに失敗しました",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, session]);

  if (!ready || !sessionResolved || loading) {
    return (
      <p className="px-4 py-16 text-center text-sm text-neutral-400">
        読み込み中...
      </p>
    );
  }

  if (!session) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (productUrl && !isHttpUrl(productUrl)) {
        throw new Error("商品リンクは http(s) のURLにしてください");
      }

      await getStore().updatePost(postId, session!.userId, {
        caption: caption.trim(),
        category,
        productUrl: productUrl.trim() || null,
        productLabel: productLabel.trim() || null,
        visualKind: visualKind || null,
      });

      router.replace(`/p/${postId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "変更の保存に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-4">
      <h1 className="text-lg font-semibold">投稿を編集</h1>

      {preview ? (
        mediaType === "video" ? (
          <video
            src={preview}
            className="mx-auto max-h-72 rounded-xl"
            controls
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="mx-auto max-h-72 rounded-xl object-cover"
          />
        )
      ) : null}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="キャプション"
        rows={3}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as CategoryId)}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      >
        {POST_CATEGORIES.map((id) => (
          <option key={id} value={id}>
            {CATEGORY_LABELS[id]}
          </option>
        ))}
      </select>

      <select
        value={visualKind}
        onChange={(e) =>
          setVisualKind(e.target.value as VisualKind | "")
        }
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      >
        {VISUAL_OPTIONS.map((item) => (
          <option key={item.id || "none"} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <input
        value={productUrl}
        onChange={(e) => setProductUrl(e.target.value)}
        placeholder="商品リンク（任意）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />

      <input
        value={productLabel}
        onChange={(e) => setProductLabel(e.target.value)}
        placeholder="ボタン名（デフォルト：商品を見る）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[#C6FF00] py-2.5 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "保存中..." : "変更を保存"}
      </button>
    </form>
  );
}
