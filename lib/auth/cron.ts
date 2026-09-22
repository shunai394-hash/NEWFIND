import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1].trim() : null;
}

/**
 * Verifies a Vercel Cron (or manually triggered) request against CRON_SECRET.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the env
 * var is configured for the invoking environment.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return false;
  return safeEqual(token, cronSecret);
}

/**
 * Verifies a request against CRON_SECRET or an integration shared secret
 * (used by endpoints that are hit both by Vercel Cron and by trusted
 * server-to-server integrations).
 */
export function isAuthorizedCronOrIntegrationRequest(
  request: Request,
  integrationSecret: string,
): boolean {
  if (isAuthorizedCronRequest(request)) return true;
  const token = bearerToken(request.headers.get("authorization"));
  const secret = integrationSecret.trim();
  if (!token || !secret) return false;
  return safeEqual(token, secret);
}
