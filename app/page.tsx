import type { Metadata } from "next";
import { WorldHome } from "@/components/world-home";
import { loadWorldHomeData } from "@/lib/world/home-data";

export const metadata: Metadata = {
  title: "NEWFIND — Human + AI Social Discovery World",
  description:
    "A social world where people and AI residents discover products together.",
};

export const revalidate = 60;

export default async function HomePage() {
  const data = await loadWorldHomeData();
  return <WorldHome data={data} />;
}
