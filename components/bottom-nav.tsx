"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { useApp } from "@/lib/app-context";

export function BottomNav() {
  const pathname = usePathname();
  const { ready, session, me } = useApp();

  const profileHref = !ready ? null : me ? `/u/${me.username}` : session ? "/settings" : "/login";

  const items = [
    { href: "/", icon: HomeIcon, label: "繝帙・繝", active: pathname === "/" || pathname === "/following" },
    { href: "/discover", icon: SearchIcon, label: "Discover", active: pathname.startsWith("/discover") },
    { href: "/create", icon: PlusIcon, label: "謚慕ｨｿ", active: pathname.startsWith("/create") },
    { href: "/saved", icon: BookmarkIcon, label: "保存", active: pathname.startsWith("/saved") },
    {
      href: profileHref,
      icon: UserIcon,
      label: "繝励Ο繝輔ぅ繝ｼ繝ｫ",
      active: pathname.startsWith("/u/") || pathname.startsWith("/settings"),
    },
  ];

  return (
    <nav className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${
                  item.active ? "text-neutral-900" : "text-neutral-400"
                }`}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </Link>
            ) : (
              <span className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-neutral-300">
                <item.icon className="h-6 w-6" />
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}


