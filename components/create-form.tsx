"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { POST_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { isHttpUrl, mediaTypeFromFile } from "@/lib/media";
import { getStore } from "@/lib/store";
import {
  normalizePostMedia,
  requirePostCaption,
} from "@/lib/posts/text-post";
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

async function createVideoThumbnail(file: File): Promise<File> {
  if (mediaTypeFromFile(file) !== "video") {
    throw new Error("動画ファイルではありません");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("動画の読み込みがタイムアウトしました"));
      }, 15000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("error", onError);
      };

      const onError = () => {
        cleanup();
        reject(new Error("動画の読み込みに失敗しました"));
      };

      video.addEventListener("error", onError, { once: true });

      video.addEventListener(
        "loadedmetadata",
        () => {
          if (!video.videoWidth || !video.videoHeight) {
            cleanup();
            reject(new Error("動画のサイズを取得できませんでした"));
            return;
          }

          const targetTime =
            Number.isFinite(video.duration) && video.duration > 0.2
              ? Math.min(0.2, video.duration - 0.05)
              : 0;

          const captureFrame = () => {
            cleanup();
            resolve();
          };

          if ("requestVideoFrameCallback" in video) {
            video
              .play()
              .then(() => {
                (
                  video as HTMLVideoElement & {
                    requestVideoFrameCallback?: (
                      callback: () => void,
                    ) => number;
                  }
                ).requestVideoFrameCallback?.(() => captureFrame());
              })
              .catch(() => {
                (video as HTMLVideoElement).currentTime = targetTime;
                (video as HTMLVideoElement).addEventListener("seeked", captureFrame, { once: true });
              });
          } else {
            (video as HTMLVideoElement).currentTime = targetTime;
            (video as HTMLVideoElement).addEventListener("seeked", captureFrame, { once: true });
          }
        },
        { once: true },
      );

      video.load();
    });

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("動画のフレームを取得できませんでした");
    }

    const canvas = document.createElement("canvas");

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);

    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("サムネイル生成用Canvasを取得できませんでした");
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });

    if (!blob || blob.size === 0) {
      throw new Error("動画フレームから画像を生成できませんでした");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");

    return new File(
      [blob],
      `${baseName}-thumbnail.jpg`,
      { type: "image/jpeg" },
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
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
      const text = requirePostCaption(caption);

      let uploadedUrl: string | null = null;
      let uploadedType: MediaType | undefined;
      let thumbnailUrl: string | null = null;

      if (file) {
        if (mediaTypeFromFile(file) === "video") {
          const thumbnailFile = await createVideoThumbnail(file);

          if (thumbnailFile) {
            const uploadedThumbnail = await store.uploadMedia(thumbnailFile);
            thumbnailUrl = uploadedThumbnail.url;
          }
        }

        const uploaded = await store.uploadMedia(file);
        uploadedUrl = uploaded.url;
        uploadedType = uploaded.type;
      } else if (mediaUrl.trim()) {
        if (!isHttpUrl(mediaUrl.trim())) {
          throw new Error("メディアURLが正しくありません");
        }
        uploadedUrl = mediaUrl.trim();
        uploadedType = /\.(mp4|webm|mov)(\?|$)/i.test(uploadedUrl)
          ? "video"
          : "photo";
      }

      const media = normalizePostMedia({
        mediaUrl: uploadedUrl,
        mediaType: uploadedType,
      });

      if (productUrl && !isHttpUrl(productUrl)) {
        throw new Error("商品リンクは http(s) のURLにしてください");
      }
      if (sourceUrl && !isHttpUrl(sourceUrl)) {
        throw new Error("BrandBridge URLが正しくありません");
      }

      const created = await store.createPost(session!.userId, {
        mediaType: media.mediaType,
        mediaUrl: media.mediaUrl,
        thumbnailUrl,
        caption: text,
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
        <h1 className="text-lg font-semibold">投稿する</h1>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-neutral-700">投稿内容</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="いま思っていることを書いてみよう"
          rows={4}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <input
        value={productUrl}
        onChange={(e) => setProductUrl(e.target.value)}
        placeholder="リンク（任意・商品URLなど）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
      <input
        value={productLabel}
        onChange={(e) => setProductLabel(e.target.value)}
        placeholder="ボタン名（任意・デフォルト：商品を見る）"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-semibold">
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            📷 カメラで撮影
          </label>

          <label className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-semibold">
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            🖼️ 写真・動画を選択
          </label>
        </div>

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
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
            <span className="text-sm text-neutral-500">
              写真・動画は任意です
            </span>
          </div>
        )}
      </div>

      <input
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder="またはメディアURL（任意）"
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
        disabled={busy || !caption.trim()}
        className="w-full rounded-lg bg-[#C6FF00] py-2.5 text-sm font-semibold text-black disabled:opacity-50"
      >
        投稿
      </button>
    </form>
  );
}



















