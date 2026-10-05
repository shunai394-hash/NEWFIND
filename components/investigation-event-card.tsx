"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/format";

export type InvestigationFeedItem = {
  id: string;
  status: string;
  title: string;
  summary?: string | null;
  beat?: string | null;
  city?: string | null;
  correspondentTitle?: string | null;
  nextAction?: string | null;
  updatedAt?: string | null;
  sourceUrl?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DISCOVERY: "新規発見",
  INVESTIGATING: "取材中",
  VERIFIED: "確認済み",
  REJECTED: "見送り",
  EXPIRED: "期限切れ",
};

// Unconfirmed leads must not look like verified facts.
const STATUS_BADGE: Record<string, string> = {
  DISCOVERY: "border border-amber-500 bg-amber-50 text-amber-800",
  INVESTIGATING: "border border-amber-500 bg-amber-50 text-amber-800",
  VERIFIED: "bg-emerald-700 text-white",
  REJECTED: "bg-neutral-200 text-neutral-700",
  EXPIRED: "bg-neutral-200 text-neutral-700",
};

const STATUS_HINT: Record<string, string> = {
  DISCOVERY: "特派員が新しい手がかりを見つけました（まだ確認前の情報です）",
  INVESTIGATING: "公式情報と第二の根拠を確認しています（未確認）",
  VERIFIED: "確認できたので、まもなく投稿・続報に進みます",
  REJECTED: "今回の担当領域では見送りました",
  EXPIRED: "古い手がかりのため打ち切りました",
};

export function InvestigationEventCard({
  item,
}: {
  item: InvestigationFeedItem;
}) {
  const status = item.status || "DISCOVERY";
  const label = STATUS_LABEL[status] || status;
  const hint = STATUS_HINT[status] || "";
  const badge = STATUS_BADGE[status] || "bg-neutral-900 text-white";
  const actor = item.correspondentTitle || "AI特派員";

  return (
    <article className="border-b border-neutral-200 bg-[#FAFAF7] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-500">
            取材デスク
            {item.city ? ` · ${item.city}` : ""}
            {item.beat ? ` · ${item.beat}` : ""}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900">
            {actor}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${badge}`}
        >
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm text-neutral-800">{item.title}</p>
      {item.summary ? (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{item.summary}</p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-neutral-500">{hint}</p>
      {item.nextAction && status === "INVESTIGATING" ? (
        <p className="mt-1 text-[11px] text-neutral-500">次: {item.nextAction}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Link
          href="/correspondents"
          className="text-xs font-semibold text-neutral-800 underline"
        >
          特派員を見る
        </Link>
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-neutral-600 underline"
          >
            情報源
          </a>
        ) : null}
        {item.updatedAt ? (
          <span className="text-[11px] uppercase tracking-wide text-neutral-400">
            {timeAgo(item.updatedAt)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
