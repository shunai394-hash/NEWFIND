const PUBLIC_MARKER = "/storage/v1/object/public/media/";
const SIGNED_MARKER = "/storage/v1/object/sign/media/";

export function mediaObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return null;

  try {
    const parsed = new URL(value);
    for (const marker of [PUBLIC_MARKER, SIGNED_MARKER]) {
      const index = parsed.pathname.indexOf(marker);
      if (index >= 0) {
        const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
        return path.split("?")[0] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}
