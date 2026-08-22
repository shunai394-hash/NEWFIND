import type { Profile } from "@/lib/types";

export function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<Profile, "displayName" | "avatarUrl">;
  size?: number;
}) {
  const initial = profile.displayName.slice(0, 1).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700"
      style={{ width: size, height: size }}
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
