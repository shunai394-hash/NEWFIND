"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "@/components/icons";
import { getStore } from "@/lib/store";

export function PostOwnerMenu({
  postId,
  userId,
  onDeleted,
}: {
  postId: string;
  userId: string;
  onDeleted?: (postId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm("この投稿を削除しますか？この操作は取り消せません。")) return;
    setBusy(true);
    try {
      const result = await getStore().deletePost(postId, userId);
      if (result.warning) window.alert(result.warning);
      onDeleted?.(postId);
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="投稿メニュー"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="absolute right-1 top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
      >
        <MoreIcon className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-[430px] overflow-hidden rounded-t-2xl bg-white"
                onClick={(event) => event.stopPropagation()}
              >
                <a
                  href={`/p/${postId}/edit`}
                  className="block w-full px-4 py-3.5 text-center text-sm font-semibold"
                >
                  編集
                </a>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete()}
                  className="block w-full border-t border-neutral-100 px-4 py-3.5 text-sm font-semibold text-red-600 disabled:opacity-50"
                >
                  {busy ? "削除中..." : "削除"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="block w-full border-t border-neutral-100 px-4 py-3.5 text-sm text-neutral-500"
                >
                  キャンセル
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
