"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

export function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<Profile, "displayName" | "avatarUrl">;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = (profile.displayName || "?").slice(0, 1).toUpperCase();
  const showImage = Boolean(profile.avatarUrl) && failedUrl !== profile.avatarUrl;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
      aria-hidden={showImage ? true : undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl!}
          alt=""
          className="h-full w-full bg-neutral-200 object-cover"
          onError={() => setFailedUrl(profile.avatarUrl ?? null)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
