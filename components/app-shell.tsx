"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { JapanSoundToggle } from "@/components/japan-sound";

const NAV_HEIGHT_PX = 56;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const showNav = !hideChrome;

  return (
    <div className="min-h-dvh bg-neutral-200">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-hidden bg-[#fafafa] shadow-xl">
        {hideChrome ? null : (
          <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top,0px)]">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="text-[21px] font-semibold tracking-tight">
                NEWFIND
              </Link>
              <div className="flex items-center gap-2">
                <JapanSoundToggle />
                <Link href="/settings" className="text-xs font-medium text-neutral-500">
                  設定
                </Link>
              </div>
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
          {children}
        </main>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
