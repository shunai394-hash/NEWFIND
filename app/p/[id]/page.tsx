import type { Metadata } from "next";
import { PostDetail } from "@/components/post-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const safeId = encodeURIComponent(id);

  return {
    title: "投稿・商品情報",
    description:
      "NEWFINDで見つけた商品やトレンドの投稿をチェック。関連情報を確認して、気になるアイテムを発見しましょう。",
    alternates: {
      canonical: `/p/${safeId}`,
    },
    openGraph: {
      title: "投稿・商品情報｜NEWFIND",
      description:
        "NEWFINDで見つけた商品やトレンドの投稿をチェック。",
      url: `/p/${safeId}`,
      type: "article",
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetail id={id} />;
}
