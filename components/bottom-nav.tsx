"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import {
  BookmarkIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import { profilePath } from "@/lib/username";

type NavItem = {
  key: string;
  href: string;
  icon: typeof HomeIcon;
  label: string;
  active: boolean;
};

export function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { session, me, refresh } = useApp();
  const lastNavAt = useRef(0);

  const profileHref = me
    ? profilePath(me.username)
    : session
      ? "/settings"
      : "/login";

  const items: NavItem[] = [
    {
      key: "home",
      href: "/",
      icon: HomeIcon,
      label: "ホーム",
      active: pathname === "/" || pathname === "/following",
    },
    {
      key: "discover",
      href: "/discover",
      icon: SearchIcon,
      label: "Discover",
      active: pathname.startsWith("/discover"),
    },
    {
      key: "create",
      href: "/create",
      icon: PlusIcon,
      label: "投稿",
      active: pathname.startsWith("/create"),
    },
    {
      key: "saved",
      href: "/saved",
      icon: BookmarkIcon,
      label: "保存",
      active: pathname.startsWith("/saved"),
    },
    {
      key: "profile",
      href: profileHref,
      icon: UserIcon,
      label: "プロフィール",
      active:
        pathname.startsWith("/u/") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/login"),
    },
  ];

  async function navigate(href: string, key: string) {
    const now = Date.now();
    if (now - lastNavAt.current < 450) return;
    lastNavAt.current = now;

    if (key === "profile") {
      if (me?.username) {
        const target = profilePath(me.username);
        if (pathname !== target) router.push(target);
        return;
      }
      if (!session) {
        if (pathname !== "/login") router.push("/login");
        return;
      }
      try {
        const profile = await getStore().ensureMyProfile(session);
        await refresh();
        const target = profilePath(profile.username);
        if (pathname !== target) router.push(target);
      } catch {
        if (pathname !== "/settings") router.push("/settings");
      }
      return;
    }

    if (href === pathname) return;
    router.push(href);
  }

  function onActivate(href: string, key: string) {
    void navigate(href, key);
  }

  return (
    <nav
      data-testid="bottom-nav"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[100] border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
      style={{ touchAction: "manipulation" }}
    >
      <div className="mx-auto w-full max-w-[430px]">
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="min-w-0">
                <a
                  href={item.href}
                  data-testid={`nav-${item.key}`}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => onActivate(item.href, item.key)}
                  className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] select-none ${
                    item.active ? "text-neutral-900" : "text-neutral-400"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
