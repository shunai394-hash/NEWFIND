"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError")
  );
}

async function notifyShared(onShared?: () => void | Promise<void>) {
  try {
    await onShared?.();
  } catch {
    // Sharing already succeeded for the user; do not hide the sheet on count errors.
  }
}

async function writeClipboard(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }
  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand("copy");
  input.remove();
  if (!ok) throw new Error("copy failed");
}

export function ShareSheet({
  url,
  title = "NEWFIND",
  onClose,
  onShared,
}: {
  url: string;
  title?: string;
  onClose: () => void;
  onShared?: () => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await writeClipboard(url);
      setCopied(true);
      setManual(false);
      await notifyShared(onShared);
    } catch {
      setManual(true);
    }
  }

  async function nativeShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title, text: title });
        await notifyShared(onShared);
        return;
      } catch (error) {
        if (isAbortError(error)) return;
      }
    }
    await copy();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] space-y-2 rounded-t-2xl bg-white p-4 text-black"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">シェア</p>
        {canNativeShare ? (
          <button
            type="button"
            onClick={() => void nativeShare()}
            className="w-full rounded-xl bg-[#C6FF00] px-4 py-3 text-left text-sm font-semibold text-black"
          >
            シェア
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copy()}
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm font-medium"
        >
          {copied ? "URLをコピーしました" : "URLをコピー"}
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
    </div>,
    document.body,
  );
}
