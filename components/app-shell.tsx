"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { useApp } from "@/lib/app-context";

const NAV_HEIGHT_PX = 56;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useApp();
  const hideChrome =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const showNav = !hideChrome && ready;

  return (
    <div className="min-h-dvh bg-neutral-200">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-hidden bg-[#fafafa] shadow-xl">
        {hideChrome ? null : (
          <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top,0px)]">
            <div className="flex items-center justify-between px-4 py-3">
              <Link
                href="/"
                className="text-[21px] font-semibold tracking-tight"
              >
                NEWFIND
              </Link>
              <Link
                href="/settings"
                className="text-xs font-medium text-neutral-500"
              >
                設定
              </Link>
            </div>
          </header>
        )}
        <main
          className="relative z-0 flex-1"
          style={
            showNav
              ? {
                  paddingBottom: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`,
                }
              : undefined
          }
        >
          {ready ? (
            children
          ) : (
            <div className="px-4 py-20 text-center text-sm text-neutral-400">
              読み込み中...
            </div>
          )}
        </main>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
