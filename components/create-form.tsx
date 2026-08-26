"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { POST_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { isHttpUrl } from "@/lib/media";
import { getStore } from "@/lib/store";
import { type CategoryId, type MediaType, type PostSource, type VisualKind } from "@/lib/types";

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

export function CreateForm() {
  const router = useRouter();
  const { ready, sessionResolved, session, me } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("photo");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<CategoryId>("fashion");
  const [visualKind, setVisualKind] = useState<VisualKind | "">("");
  const [productUrl, setProductUrl] = useState("");
  const [productLabel, setProductLabel] = useState("商品を見る");
  const [isSponsored, setIsSponsored] = useState(false);
  const [source, setSource] = useState<PostSource>("user");
  const [sourceRef, setSourceRef] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isBusiness = me?.accountType === "business";

  useEffect(() => {
    if (ready && sessionResolved && !session) router.replace("/login?next=/create");
  }, [ready, sessionResolved, session, router]);

  if (!ready || !sessionResolved) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!session) return null;

  function onFile(next: File | null) {
    setFile(next);
    if (!next) {
      setPreview("");
      return;
    }
    setMediaType(next.type.startsWith("video/") ? "video" : "photo");
    setPreview(URL.createObjectURL(next));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const store = getStore();
      let url = mediaUrl.trim();
      let type: MediaType = mediaType;

      if (file) {
        const uploaded = await store.uploadMedia(file);
        url = uploaded.url;
        type = uploaded.type;
      } else if (url) {
        if (!isHttpUrl(url)) throw new Error("メディアURLが正しくありません");
        type = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "photo";
      } else {
        throw new Error("写真または動画を追加してください");
      }

      if (productUrl && !isHttpUrl(productUrl)) {
        throw new Error("商品リンクは http(s) のURLにしてください");
      }
      if (sourceUrl && !isHttpUrl(sourceUrl)) {
        throw new Error("BrandBridge URLが正しくありません");
      }

      const created = await store.createPost(session!.userId, {
        mediaType: type,
        mediaUrl: url,
        caption: caption.trim(),
        category,
        productUrl: productUrl.trim() || null,
        productLabel: productLabel.trim() || null,
        isSponsored: isBusiness ? isSponsored : false,
        source: isBusiness ? source : "user",
        sourceRef: isBusiness ? sourceRef.trim() || null : null,
        sourceUrl: isBusiness ? sourceUrl.trim() || null : null,
        visualKind: visualKind || null,
      });
      router.replace(`/p/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-lg font-semibold">投稿</h1>
      </div>
      <label className="block rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-center">
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          mediaType === "video" ? (
            <video src={preview} className="mx-auto max-h-72 rounded-xl" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="mx-auto max-h-72 rounded-xl object-cover" />
          )
        ) : (
          <span className="text-sm text-neutral-500">画像または動画を選択</span>
        )}
      </label>

      <input
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder="またはメディアURL"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
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
        onChange={(e) => setVisualKind(e.target.value as VisualKind | "")}
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
        placeholder="商品リンク（任意・外部EC / 公式サイト）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
      <input
        value={productLabel}
        onChange={(e) => setProductLabel(e.target.value)}
        placeholder="ボタン名（デフォルト：商品を見る）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />

      {isBusiness ? (
        <div className="space-y-3 rounded-2xl bg-white p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isSponsored}
              onChange={(e) => setIsSponsored(e.target.checked)}
            />
            Sponsored投稿
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={source === "brandbridge"}
              onChange={(e) => setSource(e.target.checked ? "brandbridge" : "user")}
            />
            BrandBridgeの公式投稿として掲載
          </label>
          {source === "brandbridge" ? (
            <>
              <input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="BrandBridge商品ID（任意）"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="BrandBridge公開URL（任意）"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        シェア
      </button>
    </form>
  );
}






