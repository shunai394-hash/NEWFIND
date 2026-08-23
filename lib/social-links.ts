/** Social profile link helpers (Instagram / X / TikTok / YouTube / Website). */

export type SocialPlatform =
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube"
  | "website";

export type SocialLinks = {
  instagramUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  websiteUrl: string | null;
};

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  instagramUrl: null,
  xUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  websiteUrl: null,
};

const PLATFORM_HOST: Record<
  Exclude<SocialPlatform, "website">,
  RegExp
> = {
  instagram: /^(www\.)?instagram\.com$/i,
  x: /^(www\.)?(x\.com|twitter\.com)$/i,
  tiktok: /^(www\.)?(tiktok\.com|vm\.tiktok\.com)$/i,
  youtube: /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i,
};

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

export function validateSocialUrl(
  platform: SocialPlatform,
  raw: string,
): { ok: true; url: string | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: null };

  const normalized = normalizeHttpUrl(trimmed);
  if (!normalized) {
    return { ok: false, message: "有効な URL を入力してください（https://...）" };
  }

  if (platform === "website") {
    return { ok: true, url: normalized };
  }

  let host: string;
  try {
    host = new URL(normalized).hostname;
  } catch {
    return { ok: false, message: "有効な URL を入力してください" };
  }

  if (!PLATFORM_HOST[platform].test(host)) {
    const labels: Record<Exclude<SocialPlatform, "website">, string> = {
      instagram: "instagram.com",
      x: "x.com / twitter.com",
      tiktok: "tiktok.com",
      youtube: "youtube.com / youtu.be",
    };
    return {
      ok: false,
      message: `${labels[platform]} の URL を入力してください`,
    };
  }

  return { ok: true, url: normalized };
}

export function socialLinkEntries(
  links: SocialLinks,
): Array<{ platform: SocialPlatform; label: string; url: string }> {
  const rows: Array<{ platform: SocialPlatform; label: string; url: string }> =
    [];
  if (links.instagramUrl) {
    rows.push({ platform: "instagram", label: "Instagram", url: links.instagramUrl });
  }
  if (links.xUrl) {
    rows.push({ platform: "x", label: "X", url: links.xUrl });
  }
  if (links.tiktokUrl) {
    rows.push({ platform: "tiktok", label: "TikTok", url: links.tiktokUrl });
  }
  if (links.youtubeUrl) {
    rows.push({ platform: "youtube", label: "YouTube", url: links.youtubeUrl });
  }
  if (links.websiteUrl) {
    rows.push({ platform: "website", label: "Webサイト", url: links.websiteUrl });
  }
  return rows;
}

export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
