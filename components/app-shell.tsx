"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { useApp } from "@/lib/app-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useApp();
  const hideChrome = pathname.startsWith("/login") || pathname.startsWith("/auth");

  return (
    <div className="min-h-dvh bg-neutral-200">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#fafafa] shadow-xl">
        {hideChrome ? null : (
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
            <Link href="/" className="text-[21px] font-semibold tracking-tight">
              NEWFIND
            </Link>
            <Link href="/settings" className="text-xs font-medium text-neutral-500">
              設定
            </Link>
          </header>
        )}
        <main className="flex-1">
          {ready ? children : <div className="px-4 py-20 text-center text-sm text-neutral-400">読み込み中...</div>}
        </main>
        {hideChrome ? null : <BottomNav />}
      </div>
    </div>
  );
}
