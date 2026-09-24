"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MenuIcon } from "@/components/icons";
import { useApp } from "@/lib/app-context";
import { getStore } from "@/lib/store";

export function AppMenu() {
  const { session } = useApp();
  const signOut = async () => {
    await getStore().signOut();
    setOpen(false);
  };
  const [open, setOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="メニュー"
        onClick={() => {
          setLegalOpen(false);
          setOpen(true);
        }}
        className="p-1 text-white"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-[env(safe-area-inset-bottom,0px)]"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-[430px] overflow-hidden rounded-t-2xl bg-white text-black"
                onClick={(event) => event.stopPropagation()}
              >
                {legalOpen ? (
                  <>
                    <p className="px-4 pt-4 text-sm font-semibold">規則とプライバシー</p>
                    <Link
                      href="/terms"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3.5 text-sm"
                    >
                      利用規約
                    </Link>
                    <Link
                      href="/privacy"
                      onClick={() => setOpen(false)}
                      className="block border-t border-neutral-100 px-4 py-3.5 text-sm"
                    >
                      プライバシーポリシー
                    </Link>
                    <Link
                      href="/community-guidelines"
                      onClick={() => setOpen(false)}
                      className="block border-t border-neutral-100 px-4 py-3.5 text-sm"
                    >
                      コミュニティガイドライン
                    </Link>
                    <button
                      type="button"
                      onClick={() => setLegalOpen(false)}
                      className="block w-full border-t border-neutral-100 px-4 py-3.5 text-sm text-neutral-500"
                    >
                      戻る
                    </button>
                  </>
                ) : (
                  <>
                    {session ? (
                      <Link
                        href="/notifications"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3.5 text-sm font-semibold"
                      >
                        通知 / アラーム
                      </Link>
                    ) : null}
                    {session ? (
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="block border-t border-neutral-100 px-4 py-3.5 text-sm font-semibold"
                      >
                        設定
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3.5 text-sm font-semibold"
                      >
                        ログイン
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setLegalOpen(true)}
                      className="block w-full border-t border-neutral-100 px-4 py-3.5 text-left text-sm font-semibold"
                    >
                      規則とプライバシー
                    </button>
                    {session ? (
                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="block w-full border-t border-neutral-100 px-4 py-3.5 text-left text-sm font-semibold"
                      >
                        ログアウト
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="block w-full border-t border-neutral-100 px-4 py-3.5 text-sm text-neutral-500"
                    >
                      閉じる
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}


