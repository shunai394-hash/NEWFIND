"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { authHeaders } from "@/lib/auth/client-headers";

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  account_type: string;
  is_admin?: boolean;
  is_suspended?: boolean;
  created_at: string;
};

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users", {
      headers: await authHeaders(),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "読み込みに失敗しました");
      setUsers([]);
      return;
    }
    setError("");
    setUsers(body.users ?? []);
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function setSuspended(id: string, is_suspended: boolean) {
    if (!window.confirm(is_suspended ? "このユーザーを停止しますか？" : "停止を解除しますか？")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ is_suspended }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "更新に失敗しました");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusyId("");
    }
  }

  async function removeUser(id: string) {
    if (!window.confirm("このユーザーと投稿を削除しますか？取り消せません。")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "削除に失敗しました");
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <AdminNav current="users" />
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold">ユーザー管理</h1>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead>
              <tr className="border-b text-neutral-400">
                <th className="py-2 pr-3">ユーザー</th>
                <th className="py-2 pr-3">権限</th>
                <th className="py-2 pr-3">状態</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-neutral-400">{user.display_name}</p>
                  </td>
                  <td className="py-2 pr-3">{user.is_admin ? "admin" : "user"}</td>
                  <td className="py-2 pr-3">{user.is_suspended ? "停止" : "有効"}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      className="mr-2 underline"
                      onClick={() => void setSuspended(user.id, !user.is_suspended)}
                    >
                      {user.is_suspended ? "解除" : "停止"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      className="text-red-600 underline"
                      onClick={() => void removeUser(user.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
