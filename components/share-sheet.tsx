"use client";

import { useState } from "react";

export function ShareSheet({
  url,
  onClose,
  onShared,
}: {
  url: string;
  onClose: () => void;
  onShared: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManual(false);
      onShared();
    } catch {
      setManual(true);
    }
  }

  async function nativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "NEWFIND" });
        onShared();
        return;
      }
    } catch {
      return;
    }
    await copy();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[430px] space-y-2 rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">シェア</p>
        <button
          type="button"
          onClick={nativeShare}
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm font-medium"
        >
          シェアする
        </button>
        <button
          type="button"
          onClick={copy}
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm font-medium"
        >
          {copied ? "リンクをコピーしました" : "リンクをコピー"}
        </button>
        {manual ? (
          <input
            readOnly
            value={url}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : null}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-neutral-500">
          キャンセル
        </button>
      </div>
    </div>
  );
}
