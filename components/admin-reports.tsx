"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { authHeaders } from "@/lib/auth/client-headers";

type Report = {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  post_id: string | null;
  reason: string;
  detail: string;
  created_at: string;
  reporter?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
  target_user?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

const reasonLabels: Record<string, string> = {
  spam: "スパム",
  harassment: "嫌がらせ・誹謗中傷",
  hate: "ヘイト・差別",
  nudity: "不適切な性的コンテンツ",
  illegal: "違法または危険な内容",
  other: "その他",
};

export function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const response = await fetch("/api/admin/reports", {
      headers: await authHeaders(),
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof body.error === "string"
          ? body.error
          : "報告の読み込みに失敗しました",
      );
      setReports([]);
      return;
    }

    setError("");
    setReports(body.reports ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function deletePost(report: Report) {
    if (!report.post_id) return;

    if (
      !window.confirm(
        "この投稿を削除しますか？\n投稿に関連する画像・動画も削除されます。",
      )
    ) {
      return;
    }

    setBusyId(report.id);

    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(report.post_id)}`,
        {
          method: "DELETE",
          headers: await authHeaders(),
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "投稿の削除に失敗しました",
        );
      }

      setReports((current) =>
        current.filter((item) => item.id !== report.id),
      );

      if (body.warning) {
        window.alert(body.warning);
      }
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "投稿の削除に失敗しました",
      );
    } finally {
      setBusyId("");
    }
  }

  async function suspendUser(report: Report) {
    if (!report.target_user_id) return;

    if (
      !window.confirm(
        "このユーザーを停止しますか？\n今後の利用を制限します。",
      )
    ) {
      return;
    }

    setBusyId(report.id);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(report.target_user_id)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({ is_suspended: true }),
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "ユーザーの停止に失敗しました",
        );
      }

      window.alert("ユーザーを停止しました。");
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "ユーザーの停止に失敗しました",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <AdminNav current="reports" />

      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">報告管理</h1>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold"
          >
            更新
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}

        {reports.length === 0 && !error ? (
          <p className="mt-4 text-sm text-neutral-500">
            報告はありません。
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {reports.map((report) => {
            const busy = busyId === report.id;

            return (
              <div
                key={report.id}
                className="rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {reasonLabels[report.reason] ?? report.reason}
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      {new Date(report.created_at).toLocaleString("ja-JP")}
                    </p>
                  </div>

                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-500">
                    {report.post_id ? "投稿" : "ユーザー"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <p>
                    <span className="text-neutral-400">報告者：</span>
                    {report.reporter?.username || report.reporter_id}
                  </p>

                  <p>
                    <span className="text-neutral-400">対象：</span>
                    {report.target_user?.username ||
                      report.target_user_id ||
                      "不明"}
                  </p>

                  {report.post_id ? (
                    <p className="break-all">
                      <span className="text-neutral-400">投稿ID：</span>
                      {report.post_id}
                    </p>
                  ) : null}
                </div>

                {report.detail ? (
                  <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                    <p className="text-[11px] font-semibold text-neutral-500">
                      詳細
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {report.detail}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {report.post_id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deletePost(report)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "処理中..." : "投稿を削除"}
                    </button>
                  ) : null}

                  {report.target_user_id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void suspendUser(report)}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "処理中..." : "ユーザーを停止"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
