"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { authHeaders } from "@/lib/auth/client-headers";
import { addLocalBlock } from "@/lib/moderation/client";
import { REPORT_REASONS, reportReasonLabel, type ReportReasonId } from "@/lib/moderation/reports";

export function ReportSheet({
  postId,
  targetUserId,
  onClose,
  onBlocked,
}: {
  postId?: string | null;
  targetUserId?: string | null;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
}) {
  const [reason, setReason] = useState<ReportReasonId>("spam");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submitReport() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          reason,
          postId: postId ?? undefined,
          targetUserId: targetUserId ?? undefined,
          detail,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "通報に失敗しました");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通報に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (!targetUserId || busy) return;
    setBusy(true);
    setError("");
    try {
      addLocalBlock(targetUserId);
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ userId: targetUserId, blocked: true }),
      });
      if (!response.ok && response.status !== 401) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "ブロックに失敗しました");
      }
      onBlocked?.(targetUserId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ブロックに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] space-y-3 rounded-t-2xl bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">{done ? "通報を受け付けました" : "通報・ブロック"}</p>
        {done ? (
          <p className="text-sm text-neutral-600">
            内容を確認し、ガイドラインに沿って対応します。必要ならこのユーザーをブロックできます。
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReason(item.id)}
                  className={`rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                    reason === item.id ? "bg-black text-white" : "bg-neutral-100"
                  }`}
                >
                  {reportReasonLabel(item.id)}
                </button>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              rows={3}
              placeholder="詳細（任意）"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {done ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitReport()}
            className="w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "送信中..." : "通報する"}
          </button>
        )}
        {targetUserId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void block()}
            className="w-full rounded-xl bg-neutral-100 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"
          >
            ブロックする
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-neutral-500">
          キャンセル
        </button>
      </div>
    </div>,
    document.body,
  );
}
