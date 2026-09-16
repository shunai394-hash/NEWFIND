/**
 * Common research rejection reasons.
 * Stored as text on verification_reason — not a new database enum.
 */
export const REJECTION_REASONS = [
  "not_relevant",
  "stale",
  "low_quality",
  "duplicate",
  "insufficient_information",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export function isRejectionReason(value: string | null | undefined): value is RejectionReason {
  return Boolean(
    value && (REJECTION_REASONS as readonly string[]).includes(value),
  );
}
