"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { useApp } from "@/lib/app-context";
import { authHeaders } from "@/lib/auth/client-headers";

export function DiscoveryAdminGate({ children }: { children: React.ReactNode }) {
  const { ready, sessionResolved, session } = useApp();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    if (!session) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/me", {
        headers: await authHeaders(),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!cancelled) setAdmin(Boolean(data.admin));
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session]);

  if (!ready || !sessionResolved || admin === null) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
  }
  if (!session) {
    return (
      <p className="px-4 py-16 text-center text-sm">
        <Link href="/login?next=/admin/discovery" className="underline">
          ログイン
        </Link>
        して管理画面を開いてください。
      </p>
    );
  }
  if (!admin) {
    return (
      <p className="px-4 py-16 text-center text-sm text-neutral-500">
        管理画面は管理者のみ利用できます。
      </p>
    );
  }
  return (
    <>
      <AdminNav current="discovery" />
      {children}
    </>
  );
}
