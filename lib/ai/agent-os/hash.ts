import { createHash } from "node:crypto";

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
        lower === "mc_cid" ||
        lower === "mc_eid" ||
        lower === "ref"
      ) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

export function hashSourceUrl(url: string) {
  return createHash("sha256")
    .update(canonicalizeSourceUrl(url))
    .digest("hex");
}
