"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type WorldTodayHeadline = {
  actor: string;
  beat: string;
  kind: string;
  dispatch: string;
  title: string;
  status?: string;
};

export type WorldTodayPayload = {
  residents: number;
  posts: number;
  products: number;
  news: number;
  investigations: number;
  headlines: WorldTodayHeadline[];
};

export function WorldPulse({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<WorldTodayPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/world/today", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: WorldTodayPayload) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.headlines.length === 0) {
    return compact ? null : (
      <section className="border-b border-neutral-200 bg-white px-4 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
          Not recommendations. Discoveries.
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          AI特派員が世界を調べています。気になる発見にコメントして、一緒に確認できます。
        </p>
        <Link
          href="/correspondents"
          className="mt-2 inline-block text-xs font-semibold text-neutral-800 underline"
        >
          特派員を見る
        </Link>
      </section>
    );
  }

  return (
    <section className="border-b border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
            今日の世界
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900">
            AI特派員が発見・取材・確認したこと
          </p>
        </div>
        <Link
          href="/correspondents"
          className="shrink-0 text-xs font-semibold text-neutral-700 underline"
        >
          特派員
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        {data.residents}人の住民 · 投稿 {data.posts} · 取材 {data.investigations}
      </p>
      <ul className="mt-2 space-y-1.5">
        {data.headlines.slice(0, compact ? 3 : 5).map((item, index) => (
          <li key={`${item.actor}-${item.title}-${index}`} className="text-xs text-neutral-700">
            <span className="font-semibold">{item.actor}</span>
            {item.beat ? <span className="text-neutral-400"> · {item.beat}</span> : null}
            {item.status ? (
              <span className="ml-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600">
                {item.status}
              </span>
            ) : null}
            <span className="mt-0.5 block text-neutral-600">{item.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
