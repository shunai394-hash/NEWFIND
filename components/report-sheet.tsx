"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/app-context";
import { authHeaders } from "@/lib/auth/client-headers";
import {
  REPORT_REASONS,
  reportReasonLabel,
  type ReportReasonId,
} from "@/lib/moderation/reports";

export function ReportSheet({
  postId,
  targetUserId,
  targetUsername,
  isAiTarget,
  onClose,
  onBlocked,
}: {
  postId?: string | null;
  targetUserId?: string | null;
  targetUsername?: string | null;
  isAiTarget?: boolean;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
}) {
  const { registerBlock } = useApp();
  const [reason, setReason] = useState<ReportReasonId>("spam");
  const [detail, setDetail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const targetId = String(targetUserId ?? "").trim();
  const canBlock = Boolean(targetId);

  async function submitReport() {
    if (reportBusy || blockBusy) return;

    setReportBusy(true);
    setError("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          reason,
          postId: postId ?? undefined,
          targetUserId: targetUserId ?? undefined,
          detail,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "騾壼ｱ縺ｫ螟ｱ謨励＠縺ｾ縺励◆",
        );
      }

      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "騾壼ｱ縺ｫ螟ｱ謨励＠縺ｾ縺励◆",
      );
    } finally {
      setReportBusy(false);
    }
  }

  async function block() {
    if (!canBlock || !targetId || reportBusy || blockBusy) {
      return;
    }

    setBlockBusy(true);
    setError("");

    try {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          userId: targetId,
          blocked: true,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 401) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "繝悶Ο繝・け縺ｫ螟ｱ謨励＠縺ｾ縺励◆",
        );
      }

      registerBlock(targetId);
      onBlocked?.(targetId);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "繝悶Ο繝・け縺ｫ螟ｱ謨励＠縺ｾ縺励◆",
      );
    } finally {
      setBlockBusy(false);
    }
  }

  const anyBusy = reportBusy || blockBusy;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] space-y-3 rounded-t-2xl bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">
          {done ? "騾壼ｱ繧貞女縺台ｻ倥￠縺ｾ縺励◆" : "騾壼ｱ繝ｻ繝悶Ο繝・け"}
        </p>

        {done ? (
          <p className="text-sm text-neutral-600">
            蜀・ｮｹ繧堤｢ｺ隱阪＠縲√ぎ繧､繝峨Λ繧､繝ｳ縺ｫ豐ｿ縺｣縺ｦ蟇ｾ蠢懊＠縺ｾ縺吶ょｿ・ｦ√↑繧峨％縺ｮ繝ｦ繝ｼ繧ｶ繝ｼ繧偵ヶ繝ｭ繝・け縺ｧ縺阪∪縺吶・
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={anyBusy}
                  onClick={() => setReason(item.id)}
                  className={`rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                    reason === item.id
                      ? "bg-black text-white"
                      : "bg-neutral-100"
                  } disabled:opacity-50`}
                >
                  {reportReasonLabel(item.id)}
                </button>
              ))}
            </div>

            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              rows={3}
              disabled={anyBusy}
              placeholder="隧ｳ邏ｰ縺後≠繧後・蜈･蜉帙＠縺ｦ縺上□縺輔＞"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50"
            />
          </>
        )}

        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}

        {done ? null : (
          <button
            type="button"
            disabled={anyBusy}
            onClick={() => void submitReport()}
            className="w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {reportBusy ? "騾∽ｿ｡荳ｭ..." : "騾壼ｱ縺吶ｋ"}
          </button>
        )}

        {canBlock ? (
          <button
            type="button"
            disabled={anyBusy}
            onClick={() => void block()}
            className="w-full rounded-xl bg-neutral-100 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"
          >
            {blockBusy ? "繝悶Ο繝・け荳ｭ..." : "繝悶Ο繝・け縺吶ｋ"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={anyBusy}
          onClick={onClose}
          className="w-full py-2 text-sm text-neutral-500 disabled:opacity-50"
        >
          繧ｭ繝｣繝ｳ繧ｻ繝ｫ
        </button>
      </div>
    </div>,
    document.body,
  );
}