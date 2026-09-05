import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Guidelines | NEWFIND",
};

export default function CommunityGuidelinesPage() {
  return (
    <article className="space-y-6 px-4 py-5 text-sm leading-relaxed text-neutral-700">
      <header>
        <h1 className="text-lg font-semibold text-black">コミュニティガイドライン</h1>
        <p className="mt-2 text-xs text-neutral-500">最終更新日: 2026年8月28日</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">1. NEWFINDについて</h2>
        <p>
          NEWFINDは、ファッションや商品を発見・共有するためのSNSです。
          すべての利用者が安心してサービスを利用できるよう、互いに尊重したコミュニケーションをお願いします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">2. 尊重と思いやり</h2>
        <p>
          他の利用者に対する嫌がらせ、脅迫、差別、誹謗中傷、なりすましなど、
          他者を傷つけたり不快にさせたりする行為は禁止しています。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">3. 投稿してはいけないコンテンツ</h2>
        <p>
          違法な内容、暴力を助長する内容、わいせつな内容、差別的な内容、
          スパム、詐欺、他者の著作権・商標権・肖像権・プライバシーなどを侵害する内容は投稿できません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">4. 他者の権利を守る</h2>
        <p>
          写真、動画、文章などを投稿する場合は、投稿するために必要な権利や許可を
          利用者自身で確認してください。他者の作品や個人情報を無断で公開しないでください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">5. 通報とブロック</h2>
        <p>
          不適切な投稿やユーザーを見つけた場合は、アプリ内の通報機能をご利用ください。
          他のユーザーをブロックすることもできます。通報された内容は確認のうえ、
          必要に応じて投稿の削除、利用制限、アカウント停止などの対応を行う場合があります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">6. ガイドライン違反への対応</h2>
        <p>
          本ガイドラインに違反するコンテンツや行為が確認された場合、
          事前の通知なくコンテンツの削除、表示制限、アカウントの利用停止などを行うことがあります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-black">7. 安全なコミュニティのために</h2>
        <p>
          NEWFINDを利用するすべての人が安心して楽しめるコミュニティを維持するため、
          利用者のみなさまのご協力をお願いします。
        </p>
      </section>
    </article>
  );
}
