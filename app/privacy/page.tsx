import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | NEWFIND",
  description: "NEWFINDにおける個人情報およびユーザーデータの取り扱いについて定めたプライバシーポリシーです。",
};

const UPDATED_AT = "2026年8月28日";

export default function PrivacyPage() {
  return (
    <article className="space-y-6 px-4 py-5">
      <header>
        <h1 className="text-lg font-semibold">プライバシーポリシー</h1>
        <p className="mt-2 text-xs text-neutral-500">最終更新日: {UPDATED_AT}</p>
      </header>

      <Section title="1. はじめに">
        <p>
          本ポリシーは、アプリ「NEWFIND」（iOS / Android の Bundle ID / パッケージ名: app.newfind.social。以下「本サービス」）が、利用者の情報をどのように取得・保存・利用するかを説明します。記載内容は、本サービスに実装されている機能に基づきます。
        </p>
        <p>
          本サービスは商品発見のためのSNSです。投稿から外部の公式サイトや販売ページへ移動できます。本サービス内での商品販売、決済、配送は行いません。
        </p>
      </Section>

      <Section title="2. 取得する情報">
        <h3 className="text-sm font-semibold">2.1 アカウント登録・ログイン</h3>
        <p>利用者は次の方法でアカウントを作成またはログインできます。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>メールアドレスとパスワードによる登録・ログイン</li>
          <li>Google アカウントによるログイン</li>
          <li>Apple アカウントによるログイン</li>
        </ul>
        <p>
          登録時、メールアドレス、パスワード（認証サービス側で管理）、任意の表示名を取得します。メール登録では、設定により確認メールを送信する場合があります。
        </p>
        <p>
          Google または Apple でログインする場合、各事業者が提供する識別情報、メールアドレス（Apple の場合は Hide My Email によるリレーアドレスを含むことがあります）、表示名を認証のために利用します。
        </p>

        <h3 className="text-sm font-semibold">2.2 プロフィール</h3>
        <p>利用者が設定画面で入力・保存した次の情報を保存します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>ユーザー名、表示名、自己紹介、プロフィール画像</li>
          <li>任意の外部リンク（Instagram、X、TikTok、YouTube、Webサイト）</li>
          <li>
            ビジネスアカウントとして設定した場合の会社名、会社Webサイト、会社説明
          </li>
        </ul>

        <h3 className="text-sm font-semibold">2.3 投稿・交流に関する情報</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>投稿した写真・動画、キャプション、カテゴリ、任意の商品リンク</li>
          <li>コメント</li>
          <li>いいね、Want、保存、シェア、フォロー関係</li>
          <li>通報内容、ブロックしたユーザー</li>
        </ul>
        <p>
          投稿の画像・動画およびプロフィール画像は、ファイルとして保存されます。コメント削除の操作画面は、現時点では提供していません。
        </p>

        <h3 className="text-sm font-semibold">2.4 端末内に残る情報</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Web 版: ログイン状態を維持するための Cookie（認証用。広告目的ではありません）
          </li>
          <li>
            iOS / Android アプリ: ログイン状態を端末内のローカルストレージに保存します
          </li>
        </ul>
        <p>
          位置情報、連絡先、広告ID、解析SDK、プッシュ通知トークンは、本サービスのコード上では取得していません。アプリの利用権限は、投稿時のカメラ・マイク・フォトライブラリ（利用する場合）とインターネット通信です。
        </p>
      </Section>

      <Section title="3. 利用目的">
        <p>取得した情報は、次の目的に利用します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウントの作成、ログイン、セッション維持</li>
          <li>プロフィール、投稿、コメント、いいね、フォローなどのSNS機能の提供</li>
          <li>商品情報の表示と、外部の公式サイト・販売ページへの案内</li>
          <li>不正利用への対応、運営上必要な管理（管理者による停止・削除を含みます）</li>
        </ul>
        <p>取得した情報を、広告配信や第三者への販売には利用しません。</p>
      </Section>

      <Section title="4. 外部サービス">
        <p>本サービスは次の外部サービスを利用します。各サービスの取扱いは、それぞれのプライバシーポリシーに従います。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Supabase（認証、データベース、ファイル保存）。アカウント、プロフィール、投稿、画像・動画、いいね、フォロー、コメント等を保存します。
          </li>
          <li>Google（Google でログインする場合の認証）</li>
          <li>Apple（Apple でログインする場合の認証）</li>
        </ul>
        <p>
          Firebase、Google アナリティクス、広告SDK（AdMob 等）、クラッシュレポート専用SDKは、本アプリには組み込んでいません。
        </p>
        <p>
          本サービスはホストされたWebアプリを表示するため、通信先のサーバーやホスティング事業者が、接続に伴う一般的なアクセスログ（IPアドレス等）を記録する場合があります。本アプリ独自のアクセス解析タグは設置していません。
        </p>
      </Section>

      <Section title="5. 公開される情報">
        <p>
          ユーザー名、表示名、プロフィール、投稿、コメント、いいね数など、SNSとして表示される情報は、他の利用者から閲覧できます。メールアドレスとパスワードはプロフィール画面には表示しません。
        </p>
      </Section>

      <Section title="6. 情報の保管期間">
        <p>
          アカウントに紐づく情報は、アカウントが存在する間、サービス提供のために保管します。利用者が自分の投稿を削除した場合、その投稿データは削除します。紐づく画像ファイルも削除を試みますが、削除に失敗する場合があります。
        </p>
      </Section>

      <Section title="7. 利用者ができること">
        <p>現在、アプリ内で次の操作ができます。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>プロフィール情報の確認・変更（設定画面）</li>
          <li>自分が作成した投稿の削除</li>
          <li>いいね、フォローなどの解除</li>
          <li>ログアウト</li>
          <li>設定画面からのアカウント削除</li>
        </ul>
      </Section>

      <Section title="8. アカウント削除・データ削除">
        <p>
          利用者は、設定画面の「アカウントを削除」から、自分のアカウントを削除できます。削除の前に確認画面を表示します。他人のアカウントを削除することはできません。
        </p>
        <p>
          アカウントを削除すると、認証情報、プロフィール、自分が作成した投稿、コメント、いいね、Want、フォローが削除されます。自分が作成した投稿の画像・動画およびプロフィール画像も、可能な範囲でストレージから削除します。
        </p>
        <p>
          運営者（管理者）は、規約違反等への対応として、他の利用者のアカウントを停止または削除する場合があります。
        </p>
      </Section>

      <Section title="9. 子どもの情報">
        <p>
          本サービスは、子どもから積極的に個人情報を収集することを目的としていません。年齢確認の仕組みは、現時点では実装していません。
        </p>
      </Section>

      <Section title="10. ポリシーの変更">
        <p>
          本ポリシーは、機能の追加や法令の要請に応じて変更することがあります。変更後は、本ページの最終更新日を改定して公開します。
        </p>
      </Section>

      <Section title="11. お問い合わせ">
        <p>
          本ポリシーに関するお問い合わせは、App Store または Google Play のデベロッパー情報に記載の連絡先へご連絡ください。アプリ内に専用のお問い合わせフォームは、現時点ではありません。
        </p>
      </Section>

      <p className="pt-2 text-center">
        <Link href="/" className="text-sm font-semibold text-neutral-700">
          ホームへ戻る
        </Link>
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 text-sm leading-relaxed text-neutral-700">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      {children}
    </section>
  );
}
