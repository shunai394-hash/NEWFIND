"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { profilePath } from "@/lib/username";

export default function SavedPage() {
  const router = useRouter();
  const { ready, sessionResolved, session, me } = useApp();

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    if (!session) {
      router.replace("/login?next=/saved");
      return;
    }
    if (me?.username) {
      router.replace(`${profilePath(me.username)}?tab=saved`);
    }
  }, [ready, sessionResolved, session, me?.username, router]);

  return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
}
