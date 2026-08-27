"use client";

import { useState } from "react";
import { getStore } from "@/lib/store";

export function DeletePostButton({
  postId,
  userId,
  onDeleted,
  className = "",
  label = "削除",
}: {
  postId: string;
  userId: string;
  onDeleted?: (postId: string) => void;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!window.confirm("この投稿と画像を削除しますか？")) return;
    setBusy(true);
    try {
      const result = await getStore().deletePost(postId, userId);
      if (result.warning) window.alert(result.warning);
      onDeleted?.(postId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => void onClick(event)}
      disabled={busy}
      className={className}
    >
      {busy ? "削除中..." : label}
    </button>
  );
}
