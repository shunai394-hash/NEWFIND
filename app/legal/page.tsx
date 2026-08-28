import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rules and privacy | NEWFIND",
};

export default function LegalPage() {
  return (
    <article className="space-y-5 px-4 py-5">
      <h1 className="text-lg font-semibold">規則とプライバシー</h1>
      <p className="text-sm text-neutral-600">
        NEWFINDの利用条件と、個人情報の取り扱いです。
      </p>
      <Link href="/terms" className="block rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold">
        利用規約
      </Link>
      <Link href="/privacy" className="block rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold">
        プライバシーポリシー
      </Link>
    </article>
  );
}
