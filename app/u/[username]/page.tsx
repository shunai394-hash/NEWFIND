import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile-view";
import { normalizeUsername } from "@/lib/username";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const normalized = normalizeUsername(username);
  const canonicalPath = `/u/${encodeURIComponent(normalized)}`;

  return {
    title: `@${normalized} のプロフィール`,
    description: `@${normalized} のプロフィールとNEWFINDでの投稿をチェック。`,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `@${normalized} のプロフィール｜NEWFIND`,
      description: `@${normalized} のプロフィールと投稿。`,
      url: canonicalPath,
      type: "profile",
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>}>
      <ProfileView username={normalizeUsername(username)} />
    </Suspense>
  );
}
