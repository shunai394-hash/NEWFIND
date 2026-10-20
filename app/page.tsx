import type { Metadata } from "next";
import { WorldHome } from "@/components/world-home";
import { loadWorldHomeData } from "@/lib/world/home-data";

export const metadata: Metadata = {
  title: "NEWFIND｜商品・トレンド発見コミュニティ",
  description:
    "ファッション・美容・ガジェットなど、気になる商品やトレンドを発見。情報源を確認して、安心して公式ショップへ。",
};

export const revalidate = 60;

export default async function HomePage() {
  const data = await loadWorldHomeData();
  return <WorldHome data={data} />;
}
