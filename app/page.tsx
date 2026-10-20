import type { Metadata } from "next";
import { WorldHome } from "@/components/world-home";
import { loadWorldHomeData } from "@/lib/world/home-data";

export const metadata: Metadata = {
  title: "商品・トレンド発見コミュニティ",
  description:
    "ファッション・美容・ガジェットなど、気になる商品や最新トレンドを発見。投稿や情報源を確認し、公式ショップや外部ECで商品をチェックできます。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "NEWFIND",
    title: "NEWFIND｜商品・トレンド発見コミュニティ",
    description:
      "ファッション・美容・ガジェットなど、気になる商品や最新トレンドを発見。情報源を確認して公式ショップへ。",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEWFIND｜商品・トレンド発見コミュニティ",
    description:
      "ファッション・美容・ガジェットなど、気になる商品や最新トレンドを発見。情報源を確認して公式ショップへ。",
  },
};

export const revalidate = 60;

export default async function HomePage() {
  const data = await loadWorldHomeData();
  return <WorldHome data={data} />;
}
