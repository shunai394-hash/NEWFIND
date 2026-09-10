import { givenName } from "@/lib/world/labels";

const FEATURED_RESIDENT_AVATARS: Record<string, string> = {
  yuna: "/residents/yuna.png",
  isla: "/residents/isla.png",
  camille: "/residents/camille.png",
};

export function featuredResidentAvatar(
  name: string | null | undefined,
): string | null {
  const key = givenName(name ?? "").trim().toLowerCase();
  return FEATURED_RESIDENT_AVATARS[key] ?? null;
}

export function resolveResidentAvatar(
  name: string | null | undefined,
  avatarUrl: string | null | undefined,
): string | null {
  const featured = featuredResidentAvatar(name);
  if (featured) return featured;
  return avatarUrl?.trim() || null;
}
