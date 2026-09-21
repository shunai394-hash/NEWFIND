/** Staged retry: 1m, 5m, 15m, 1h, 6h (then stay at 6h). */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function nextRetryAt(attemptsAfterFailure: number, now = Date.now()): Date {
  const index = Math.min(
    Math.max(0, attemptsAfterFailure - 1),
    RETRY_DELAYS_MS.length - 1,
  );
  return new Date(now + RETRY_DELAYS_MS[index]!);
}

export function isRetryableHttpStatus(status: number | null | undefined): boolean {
  if (status == null) return true; // timeout / network
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function isPermanentHttpStatus(status: number | null | undefined): boolean {
  if (status == null) return false;
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 422;
}