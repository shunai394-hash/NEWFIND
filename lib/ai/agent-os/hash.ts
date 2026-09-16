import { createHash } from "node:crypto";

export function canonicalizeSourceUrl(url: string) {
  return url.trim().replace(/\/$/, "").toLowerCase();
}

export function hashSourceUrl(url: string) {
  return createHash("sha256")
    .update(canonicalizeSourceUrl(url))
    .digest("hex");
}
