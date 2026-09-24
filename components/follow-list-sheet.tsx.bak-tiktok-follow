"use client";
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/avatar";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";
import { normalizeUsername } from "@/lib/username";
import type { FollowListEntry } from "@/lib/types";

type Mode = "followers" | "following";

export function FollowListSheet({
  userId,
  mode,
  expectedCount,
  onClose,
  onCountsChanged,
}: {
  userId: string;
  mode: Mode;
  /** Profile header count — list must match this when data is consistent. */
  expectedCount?: number;
  onClose: () => void;
  onCountsChanged?: () => void;
}) {
  const { session, refresh } = useApp();
  const [entries, setEntries] = useState<FollowListEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const title = mode === "followers" ? "フォロワー" : "フォロー";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setEntries(null);
      setLoadError(null);
      try {
        const store = getStore();
        const list =
          mode === "followers"
            ? await store.listFollowers(userId, session?.userId ?? null)
            : await store.listFollowing(userId, session?.userId ?? null);
        if (cancelled) return;
        setEntries(list);
        if (
          typeof expectedCount === "number" &&
          expectedCount >= 0 &&
          list.length !== expectedCount
        ) {
          console.warn("[FollowListSheet] count mismatch", {
            mode,
            userId,
            expectedCount,
            listed: list.length,
          });
        }
      } catch (err) {
        console.error("[FollowListSheet] load error", err);
        if (!cancelled) {
          setLoadError("一覧を読み込めませんでした");
          setEntries([]);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId, mode, session?.userId, expectedCount]);

  async function onToggle(entry: FollowListEntry) {
    if (!session) {
      window.location.href = `/login?next=/u/${encodeURIComponent(normalizeUsername(entry.profile.username))}`;
      return;
    }
    if (entry.profile.id === session.userId) return;
    setBusyId(entry.profile.id);
    try {
      const next = await getStore().toggleFollow(entry.profile.id, session.userId);
      setEntries((prev) =>
        (prev ?? []).map((item) =>
          item.profile.id === entry.profile.id ? { ...item, following: next } : item,
        ),
      );
      onCountsChanged?.();
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[430px] flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[80vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {entries ? (
              <p className="text-xs text-neutral-400">
                {entries.length.toLocaleString("ja-JP")}人
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-lg leading-none text-neutral-500 hover:bg-neutral-100"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {entries === null ? (
            <p className="py-10 text-center text-sm text-neutral-400">読み込み中...</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-neutral-500">{loadError}</p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">まだいません</p>
          ) : (
            entries.map((entry) => {
              const mine = session?.userId === entry.profile.id;
              return (
                <div
                  key={entry.profile.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-50"
                >
                  <Link
                    href={`/u/${encodeURIComponent(normalizeUsername(entry.profile.username))}`}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar profile={entry.profile} size={40} />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-semibold">{entry.profile.displayName}</p>
                      <p className="truncate text-xs text-neutral-400">@{entry.profile.username}</p>
                    </div>
                  </Link>
                  {!mine ? (
                    <button
                      type="button"
                      disabled={busyId === entry.profile.id}
                      onClick={() => void onToggle(entry)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                        entry.following
                          ? "bg-neutral-100 text-neutral-700"
                          : "bg-neutral-900 text-white"
                      }`}
                    >
                      {entry.following ? "フォロー中" : "フォロー"}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
