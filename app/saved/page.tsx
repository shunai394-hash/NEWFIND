"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { profilePath } from "@/lib/username";

export default function SavedPage() {
  const router = useRouter();
  const { ready, sessionResolved, session, me, refresh } = useApp();

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    let cancelled = false;
    void (async () => {
      let current = session;
      if (!current) {
        current = await refresh();
      }
      if (cancelled) return;
      if (!current) {
        router.replace("/login?next=/saved");
        return;
      }
      if (me?.username) {
        router.replace(`${profilePath(me.username)}?tab=saved`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, sessionResolved, session, me?.username, refresh, router]);

  return <p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>;
}
