"use client";

import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";

export function AdminHome() {
  return (
    <div>
      <AdminNav current="home" />
      <div className="space-y-3 px-4 py-4">
        <h1 className="text-lg font-semibold">管理画面</h1>
        <Link href="/admin/users" className="block rounded-xl bg-white px-4 py-3 text-sm font-semibold">
          ユーザー管理
        </Link>
        <Link href="/admin/posts" className="block rounded-xl bg-white px-4 py-3 text-sm font-semibold">
          投稿 / 画像管理
        </Link>
        <Link href="/admin/discovery" className="block rounded-xl bg-white px-4 py-3 text-sm font-semibold">
          Discovery Manager
        </Link>
      </div>
    </div>
  );
}
