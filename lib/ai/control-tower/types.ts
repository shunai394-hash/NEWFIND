export type EngineRunType =
  | "ai_engine"
  | "world_scout"
  | "product_hunter"
  | "retry";

export type EngineRunStatus =
  | "running"
  | "success"
  | "failed"
  | "no_action"
  | "skipped";

export type EngineTrigger = "cron" | "admin" | "retry";

export type HealthLevel =
  | "active"
  | "low_activity"
  | "stalled"
  | "error"
  | "no_action"
  | "paused"
  | "unknown";

export type ErrorKind =
  | "search"
  | "ai_api"
  | "database"
  | "timeout"
  | "invalid_product"
  | "duplicate"
  | "verification_failure"
  | "post_failure"
  | "unknown";

export type ActivityAction =
  | "search"
  | "candidate_found"
  | "verification"
  | "discovery_received"
  | "posted"
  | "reacted"
  | "no_action"
  | "error"
  | "paused"
  | "resumed"
  | "run_started"
  | "run_finished";

export type ControlTowerAlert = {
  level: "red" | "yellow";
  code: string;
  message: string;
};

export type SystemNodeStatus = {
  id: "ai_engine" | "world_scout" | "product_hunter" | "ai_posts" | "database" | "cron";
  label: string;
  level: HealthLevel;
  lastAt: string | null;
  detail: string;
};

export type ResidentTowerRow = {
  personaId: string;
  profileId: string;
  name: string;
  username: string | null;
  role: string;
  countryCode: string | null;
  avatarUrl: string | null;
  level: HealthLevel;
  lastActionAt: string | null;
  lastAction: string | null;
  discoveries: number;
  posts: number;
  reactions: number;
  noAction: boolean;
};

export type ActivityLogRow = {
  id: string;
  occurredAt: string;
  actorName: string;
  actorRole: string;
  countryCode?: string | null;
  action: string;
  detail: string;
  relatedProductId: string | null;
};

export type ControlTowerSnapshot = {
  generatedAt: string;
  paused: boolean;
  running: boolean;
  runningSince: string | null;
  system: SystemNodeStatus[];
  activity: {
    lastDiscoveryAt: string | null;
    lastPostAt: string | null;
    lastReactionAt: string | null;
    lastScoutRunAt: string | null;
  };
  today: {
    scouts: number;
    candidates: number;
    verified: number;
    posts: number;
    reactions: number;
    searches: number;
    errors: number;
  };
  counters: {
    successfulSearches: number;
    candidateCount: number;
    verifiedCount: number;
    postCount: number;
    reactionCount: number;
    errorCount: number;
    consecutiveFailures: number;
    noActionCount: number;
  };
  lastError: {
    kind: string | null;
    message: string | null;
    at: string | null;
  };
  residents: ResidentTowerRow[];
  logs: ActivityLogRow[];
  alerts: ControlTowerAlert[];
  cron: {
    lastScheduledAt: string | null;
    lastSuccessAt: string | null;
    lastFailedAt: string | null;
    consecutiveFailures: number;
  };
};
