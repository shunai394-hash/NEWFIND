import { createHash } from "node:crypto";

/**
 * Canonical URL for source identity.
 *
 * Host names are case-insensitive, but URL paths and query values can be
 * case-sensitive. Never lowercase the full serialized URL: doing so can merge
 * two distinct articles on case-sensitive publishers. Remove only known
 * tracking parameters; generic parameters such as "ref" may identify content.
 */
export function canonicalizeSourceUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        lower === "fbclid" ||
        lower === "gclid" ||
        lower === "dclid" ||
        lower === "msclkid" ||
        lower === "yclid" ||
        lower === "igshid" ||
        lower === "mc_cid" ||
        lower === "mc_eid"
      ) {
        parsed.searchParams.delete(key);
      }
    }
    const serialized = parsed.toString();
    return serialized.endsWith("/") ? serialized.slice(0, -1) : serialized;
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

export function hashSourceUrl(url: string) {
  return createHash("sha256")
    .update(canonicalizeSourceUrl(url))
    .digest("hex");
}
