import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use | NEWFIND",
};

export default function TermsPage() {
  return (
    <article className="space-y-6 px-4 py-5 text-sm leading-relaxed text-neutral-700">
      <header>
        <h1 className="text-lg font-semibold text-black">利用規約</h1>
        <p className="mt-2 text-xs text-neutral-500">最終更新日: 2026年9月10日</p>
      </header>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">1. 適用</h2>
        <p>
          本規約は NEWFIND の利用条件です。新規アカウントを作成する際に、本規約およびプライバシーポリシーへの同意が必要です。同意いただけない場合、アカウントを作成できません。
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
        <h2 className="font-semibold text-black">4. 禁止事項</h2>
        <p>
          投稿した写真・動画・キャプション・コメントの権利は利用者に帰属します。ただし、次の行為は禁止します。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>不適切なコンテンツの投稿</li>
          <li>違法なコンテンツの投稿、または違法行為を助長する投稿</li>
          <li>嫌がらせ、脅迫、いじめ、ヘイト、差別的な発言</li>
          <li>他のユーザーへの迷惑行為、つきまとい、なりすまし</li>
          <li>わいせつな内容、暴力の煽動、スパム</li>
          <li>他者の権利（著作権、商標、肖像、プライバシー等）を侵害する行為</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">5. 通報・ブロック・違反時の対応</h2>
        <p>
          不適切な投稿やユーザーは、アプリ内の Report（通報）機能から報告できます。他のユーザーは Block（ブロック）機能で遮断できます。ブロックしたユーザーの投稿は表示されません。
        </p>
        <p>
          当社は通報内容を確認し、規約違反がある場合、コンテンツの削除、機能制限、アカウント停止または削除などの措置を取ることがあります。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-black">6. 連絡先</h2>
        <p>お問い合わせは、アプリ内の設定または App Store のサポート連絡先をご利用ください。</p>
      </section>
    </article>
  );
}
