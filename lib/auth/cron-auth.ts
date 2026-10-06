import { createHash, timingSafeEqual } from "crypto";

/**
 * Shared-secret checks for cron and integration endpoints.
 * Values are compared as SHA-256 digests with timingSafeEqual, so neither the
 * content nor the length of a secret leaks through response timing, and
 * nothing about the secret is ever echoed back to the caller.
 */

export function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right) && a.length === b.length;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** True when the request carries `Authorization: Bearer <one of secrets>`. Empty secrets never match. */
export function hasBearerSecret(request: Request, secrets: Array<string | null | undefined>): boolean {
  const token = bearerToken(request);
  if (!token) return false;
  let matched = false;
  for (const secret of secrets) {
    const value = secret?.trim();
    // Evaluate every candidate so timing does not reveal which one matched.
    if (value && constantTimeEqual(token, value)) matched = true;
  }
  return matched;
}

export const UNAUTHORIZED_BODY = { ok: false, error: "Unauthorized" } as const;
