import { ProfileView } from "@/components/profile-view";
import { normalizeUsername } from "@/lib/username";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfileView username={normalizeUsername(username)} />;
}
