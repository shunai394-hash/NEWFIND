"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";

type Inquiry = {
  id: string;
  email: string | null;
  category: string;
  subject: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

function authHeaders(): HeadersInit {
  return {};
}

export function AdminInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/inquiries", {
        headers: authHeaders(),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "お問い合わせの取得に失敗しました。");
      }

      setInquiries(data.inquiries ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "お問い合わせの取得に失敗しました。"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: "open" | "resolved") {
    try {
      const response = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "更新に失敗しました。");
      }

      setInquiries((current) =>
        current.map((item) =>
          item.id === id ? data.inquiry : item
        )
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "更新に失敗しました。"
      );
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <AdminNav current="inquiries" />

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">お問い合わせ</h1>
            <p className="mt-1 text-sm text-gray-500">
              NEWFINDのサポート問い合わせを管理します。
            </p>
          </div>

          <button
            onClick={() => void load()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            更新
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-gray-500">読み込み中...</p>
        ) : inquiries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
            お問い合わせはありません。
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {inquiries.map((inquiry) => (
              <article
                key={inquiry.id}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                    {inquiry.category}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      inquiry.status === "open"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {inquiry.status === "open" ? "未対応" : "対応済み"}
                  </span>

                  <span className="text-xs text-gray-400">
                    {new Date(inquiry.created_at).toLocaleString("ja-JP")}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold">{inquiry.subject}</h2>

                {inquiry.email && (
                  <p className="mt-2 text-sm text-gray-600">
                    返信先:{" "}
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="underline"
                    >
                      {inquiry.email}
                    </a>
                  </p>
                )}

                <div className="mt-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-6">
                  {inquiry.message}
                </div>

                <div className="mt-4">
                  {inquiry.status === "open" ? (
                    <button
                      onClick={() => void updateStatus(inquiry.id, "resolved")}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      対応済みにする
                    </button>
                  ) : (
                    <button
                      onClick={() => void updateStatus(inquiry.id, "open")}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                    >
                      未対応に戻す
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
