import { Suspense } from "react";
import { ProfileView } from "@/components/profile-view";
import { normalizeUsername } from "@/lib/username";

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
