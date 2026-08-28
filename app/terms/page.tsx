import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use | NEWFIND",
};

export default function TermsPage() {
  return (
    <article className="space-y-6 px-4 py-5 text-sm leading-relaxed text-neutral-700">
      <header>
        <h1 className="text-lg font-semibold text-black">利用規約</h1>
        <p className="mt-2 text-xs text-neutral-500">最終更新日: 2026年8月28日</p>
      </header>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">1. 適用</h2>
        <p>
          本規約は NEWFIND の利用条件です。本サービスを利用した時点で、本規約に同意したものとみなします。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">2. 本サービス</h2>
        <p>
          NEWFIND はファッションや商品を発見・共有する SNS です。投稿から外部の販売ページへ移動できますが、本サービス内での商品販売・決済・配送は行いません。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">3. アカウント</h2>
        <p>
          ログイン情報は利用者自身で管理してください。他者のアカウントを無断で使ってはなりません。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">4. 投稿</h2>
        <p>
          投稿した写真・動画・キャプション・コメントの権利は利用者に帰属します。違法、中傷、差別、わいせつ、スパム、他者の権利を侵害する内容は投稿できません。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">5. 通報とブロック</h2>
        <p>
          不適切な投稿やユーザーはアプリ内から通報できます。他のユーザーをブロックすると、その人の投稿は表示されません。当社は通報を確認し、投稿削除やアカウント停止などの対応を取ることがあります。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">6. 連絡先</h2>
        <p>お問い合わせは、アプリ内の設定または App Store のサポート連絡先をご利用ください。</p>
      </section>
    </article>
  );
}
