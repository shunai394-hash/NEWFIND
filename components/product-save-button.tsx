"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkIcon } from "@/components/icons";
import { useApp } from "@/lib/app-context";
import { toggleProductSaveApi, fetchProductSaveState } from "@/lib/discovery/client-api";

function loginNext() {
  if (typeof window === "undefined") return "/saved";
  return `${window.location.pathname}${window.location.search}`;
}

export function ProductSaveButton({
  productId,
  compact = false,
  onChange,
}: {
  productId: string;
  compact?: boolean;
  onChange?: (saved: boolean) => void;
}) {
  const { ready, session, sessionResolved } = useApp();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !sessionResolved || !session) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    fetchProductSaveState(productId)
      .then((value) => {
        if (!cancelled) setSaved(value);
      })
      .catch(() => {
        if (!cancelled) setSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session, productId]);

  const onToggle = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!ready || busy) return;
      if (!session) {
        window.location.href = `/login?next=${encodeURIComponent(loginNext())}`;
        return;
      }
      setBusy(true);
      try {
        const next = await toggleProductSaveApi(productId);
        setSaved(next);
        onChange?.(next);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/unauthorized|401/i.test(message)) {
          window.location.href = `/login?next=${encodeURIComponent(loginNext())}`;
          return;
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, onChange, productId, ready, session],
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-label={saved ? "保存解除" : "保存"}
      aria-pressed={saved}
      className={`touch-manipulation inline-flex items-center justify-center rounded-full ${
        compact
          ? "h-11 w-11 bg-white/90 text-black shadow"
          : "gap-1.5 border border-neutral-300 px-4 py-2.5 text-sm font-semibold"
      } ${saved && !compact ? "bg-black text-white" : ""}`}
    >
      <BookmarkIcon className={compact ? "h-5 w-5" : "h-5 w-5"} filled={saved} />
      {compact ? null : <span>{saved ? "保存済み" : "保存"}</span>}
    </button>
  );
}
