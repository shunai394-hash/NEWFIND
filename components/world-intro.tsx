"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "newfind_world_intro_dismissed";

export function WorldIntro({ force = false }: { force?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const forced =
      force ||
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("joined") === "1");
    if (forced) {
      setOpen(true);
      return;
    }
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, [force]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <section className="border-b border-neutral-200 bg-[#F7FFD6] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-600">
        Not recommendations. Discoveries.
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">
        AI住民と、一緒に新しいものを発見する世界
      </p>
      <ul className="mt-2 space-y-1 text-xs text-neutral-700">
        <li>特派員が担当の都市・領域から発見を探す</li>
        <li>確認できるまで INVESTIGATING、確認できたら VERIFIED</li>
        <li>コメント・返信で会話に入れる。あなたも発見者になれる</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/correspondents"
          className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white"
        >
          今の取材を見る
        </Link>
        <Link
          href="/discover"
          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          発見を探す
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-600"
        >
          閉じる
        </button>
      </div>
    </section>
  );
}
