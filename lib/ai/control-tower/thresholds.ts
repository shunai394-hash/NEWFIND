/**
 * Activity windows derived from current schedules in vercel.json.
 * Cron currently runs /api/ai-act once daily at 06:00 UTC.
 * Tighten these values if cron frequency increases; do not scatter magic numbers.
 */
export const CONTROL_TOWER_THRESHOLDS = {
  cronExpectedMs: 24 * 60 * 60 * 1000,
  cronStaleMs: 30 * 60 * 60 * 1000,
  engineActiveMs: 26 * 60 * 60 * 1000,
  scoutActiveMs: 26 * 60 * 60 * 1000,
  hunterActiveMs: 26 * 60 * 60 * 1000,
  postsActiveMs: 26 * 60 * 60 * 1000,
  reactionActiveMs: 26 * 60 * 60 * 1000,
  lowActivityNoDiscoveryMs: 48 * 60 * 60 * 1000,
  residentActiveMs: {
    high: 36 * 60 * 60 * 1000,
    medium: 48 * 60 * 60 * 1000,
    low: 72 * 60 * 60 * 1000,
  },
  consecutiveFailureAlert: 3,
  lockStaleMs: 6 * 60 * 1000,
} as const;

export type ActivityLevel = "high" | "medium" | "low";

export function residentActiveWindowMs(level: string | null | undefined) {
  if (level === "high") return CONTROL_TOWER_THRESHOLDS.residentActiveMs.high;
  if (level === "low") return CONTROL_TOWER_THRESHOLDS.residentActiveMs.low;
  return CONTROL_TOWER_THRESHOLDS.residentActiveMs.medium;
}
