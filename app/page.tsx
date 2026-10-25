import type { Metadata } from "next";
import { WorldHome } from "@/components/world-home";
import { loadWorldHomeData } from "@/lib/world/home-data";

export const metadata: Metadata = {
  title: "NEWFIND｜レディースファッション・コスメ・新商品発見",
  description:
    "ファッション・コスメ・スニーカー・ガジェットなどの新商品やトレンドを発見。気になる商品の情報源や公式販売先を確認できます。",
};

export const revalidate = 60;

export default async function HomePage() {
  const data = await loadWorldHomeData();
  return <WorldHome data={data} />;
}
