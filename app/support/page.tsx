import Link from "next/link";
import { SupportForm } from "@/components/support-form";

export const metadata = {
  title: "サポート | NEWFIND",
  description: "NEWFINDのお問い合わせ・サポートページです。",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-gray-500 hover:text-black"
        >
          ← NEWFIND
        </Link>

        <h1 className="text-3xl font-bold tracking-tight">
          NEWFIND サポート
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          NEWFINDに関するご質問、不具合のご報告、ご意見などはこちらからお問い合わせください。
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <SupportForm />
        </div>

        <div className="mt-8 space-y-2 text-sm text-gray-500">
          <p>
            投稿やユーザーに関する報告は、アプリ内の通報機能をご利用ください。
          </p>

          <div className="flex gap-4">
            <Link href="/privacy" className="underline">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="underline">
              利用規約
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
