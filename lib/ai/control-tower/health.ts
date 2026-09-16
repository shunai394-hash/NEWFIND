import type { HealthLevel } from "./types";

export function hoursAgoLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "記録なし";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "記録なし";
  const delta = Math.max(0, now - then);
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}時間前`;
  const days = Math.round(hours / 24);
  return `${days}日前`;
}

export function healthFromFreshness(input: {
  lastAt: string | null | undefined;
  activeMs: number;
  lowMs?: number;
  hadError?: boolean;
  consecutiveFailures?: number;
  noAction?: boolean;
  paused?: boolean;
  now?: number;
}): HealthLevel {
  if (input.paused) return "paused";
  if (input.hadError || (input.consecutiveFailures ?? 0) >= 3) return "error";
  if (!input.lastAt) return "unknown";
  const then = Date.parse(input.lastAt);
  if (!Number.isFinite(then)) return "unknown";
  const age = (input.now ?? Date.now()) - then;
  if (age > input.activeMs) return "stalled";
  if (input.noAction) return "no_action";
  if (input.lowMs && age > input.lowMs) return "low_activity";
  return "active";
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  active: "ACTIVE",
  low_activity: "LOW ACTIVITY",
  stalled: "STALLED",
  error: "ERROR",
  no_action: "NO ACTION",
  paused: "PAUSED",
  unknown: "NO DATA",
};

export const HEALTH_DOT: Record<HealthLevel, string> = {
  active: "🟢",
  low_activity: "🟡",
  stalled: "🔴",
  error: "🔴",
  no_action: "⚪",
  paused: "⏸",
  unknown: "⚪",
};
