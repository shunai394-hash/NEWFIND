import { createAdminClient } from "@/lib/supabase/admin";
import { CONTROL_TOWER_THRESHOLDS, residentActiveWindowMs } from "./thresholds";
import { healthFromFreshness } from "./health";
import { errorKindLabel } from "./errors";
import { latestCronRuns, readEngineControl } from "./runs";
import { loadAgentOsTower } from "@/lib/ai/agent-os/snapshot";
import type {
  ActivityLogRow,
  ControlTowerAlert,
  ControlTowerSnapshot,
  HealthLevel,
  ResidentTowerRow,
  SystemNodeStatus,
} from "./types";

function startOfUtcDay(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function isMissing(message: string) {
  return /42P01|42703|schema cache/i.test(message);
}

async function countTable(
  table: string,
  options?: { statusIn?: string[]; statusEq?: string },
): Promise<number> {
  try {
    const admin = createAdminClient();
    const base = admin.from(table).select("id", { count: "exact", head: true });
    const filtered = options?.statusIn
      ? base.in("status", options.statusIn)
      : options?.statusEq
        ? base.eq("status", options.statusEq)
        : base;
    const { count, error } = await filtered;
    if (error) return 0;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

export async function loadControlTowerSnapshot(): Promise<ControlTowerSnapshot> {
  const now = Date.now();
  const todayStart = startOfUtcDay();
  const admin = createAdminClient();
  const control = await readEngineControl();
  const cronRuns = await latestCronRuns();

  let dbOk = false;
  try {
    const ping = await admin.from("ai_personas").select("id").limit(1);
    dbOk = !ping.error;
  } catch {
    dbOk = false;
  }

  const latestByType = async (runType: string) => {
    const { data, error } = await admin
      .from("ai_engine_runs")
      .select("started_at, finished_at, status, error, error_kind, triggered_by")
      .eq("run_type", runType)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissing(error.message)) return null;
      throw new Error(error.message);
    }
    return data;
  };

  let engineRun = null;
  let scoutRun = null;
  let hunterRun = null;
  try {
    [engineRun, scoutRun, hunterRun] = await Promise.all([
      latestByType("ai_engine"),
      latestByType("world_scout"),
      latestByType("product_hunter"),
    ]);
  } catch (error) {
    if (!(error instanceof Error && isMissing(error.message))) {
      console.warn("engine run lookup failed", error);
    }
  }

  const lastCron = cronRuns[0] ?? null;
  const lastCronSuccess =
    cronRuns.find((row) => row.status === "success" || row.status === "no_action") ??
    null;
  const lastCronFail = cronRuns.find((row) => row.status === "failed") ?? null;
  let cronConsecutiveFails = 0;
  for (const row of cronRuns) {
    if (row.status === "failed") cronConsecutiveFails += 1;
    else break;
  }

  const [
    lastDiscovery,
    lastPost,
    lastReactionLog,
    lastScoutLog,
    todayCandidates,
    todayVerified,
    todayPosts,
    todayLogs,
  ] = await Promise.all([
    admin
      .from("discovery_products")
      .select("discovered_at, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ai_posts")
      .select("published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ai_activity_logs")
      .select("occurred_at")
      .eq("action", "reacted")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ai_activity_logs")
      .select("occurred_at")
      .in("action", ["search", "candidate_found"])
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("discovery_products")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("discovery_products")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "approved"])
      .gte("created_at", todayStart),
    admin
      .from("ai_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", todayStart),
    admin
      .from("ai_activity_logs")
      .select("action, occurred_at")
      .gte("occurred_at", todayStart)
      .limit(500),
  ]);

  const lastDiscoveryAt =
    (lastDiscovery.data?.discovered_at as string | null) ||
    (lastDiscovery.data?.created_at as string | null) ||
    null;
  const lastPostAt =
    (lastPost.data?.published_at as string | null) ||
    (lastPost.data?.created_at as string | null) ||
    null;
  const lastReactionAt =
    (lastReactionLog.data?.occurred_at as string | null) ?? null;
  const lastScoutAt =
    (scoutRun?.started_at as string | null) ||
    (lastScoutLog.data?.occurred_at as string | null) ||
    null;

  const todayActions = todayLogs.error ? [] : (todayLogs.data ?? []);
  const todayScouts = todayActions.filter((row) => row.action === "search").length;
  const todayReactions = todayActions.filter((row) => row.action === "reacted").length;
  const todayErrors = todayActions.filter((row) => row.action === "error").length;
  const todayNoAction = todayActions.filter((row) => row.action === "no_action").length;

  const consecutiveFailures = control?.consecutive_failures ?? 0;
  const engineLastAt = (engineRun?.started_at as string | null) ?? null;
  const hunterLastAt =
    (hunterRun?.started_at as string | null) || lastDiscoveryAt;
  const postsToday = typeof todayPosts.count === "number" ? todayPosts.count : 0;

  const engineLevel = healthFromFreshness({
    lastAt: engineLastAt,
    activeMs: CONTROL_TOWER_THRESHOLDS.engineActiveMs,
    hadError: engineRun?.status === "failed" || consecutiveFailures >= 3,
    consecutiveFailures,
    noAction: engineRun?.status === "no_action",
    paused: Boolean(control?.paused),
    now,
  });
  const scoutLevel = healthFromFreshness({
    lastAt: lastScoutAt,
    activeMs: CONTROL_TOWER_THRESHOLDS.scoutActiveMs,
    lowMs: CONTROL_TOWER_THRESHOLDS.lowActivityNoDiscoveryMs,
    hadError: scoutRun?.status === "failed",
    noAction: scoutRun?.status === "no_action",
    paused: Boolean(control?.paused),
    now,
  });
  const hunterLevel = healthFromFreshness({
    lastAt: hunterLastAt,
    activeMs: CONTROL_TOWER_THRESHOLDS.hunterActiveMs,
    lowMs: CONTROL_TOWER_THRESHOLDS.lowActivityNoDiscoveryMs,
    hadError: hunterRun?.status === "failed",
    noAction: hunterRun?.status === "no_action",
    paused: Boolean(control?.paused),
    now,
  });
  const postsLevel = healthFromFreshness({
    lastAt: lastPostAt,
    activeMs: CONTROL_TOWER_THRESHOLDS.postsActiveMs,
    now,
  });
  const cronLevel: HealthLevel = !lastCron
    ? "unknown"
    : lastCron.status === "failed" || cronConsecutiveFails >= 3
      ? "error"
      : healthFromFreshness({
          lastAt: lastCron.started_at as string,
          activeMs: CONTROL_TOWER_THRESHOLDS.cronStaleMs,
          noAction: lastCron.status === "no_action",
          now,
        });

  const system: SystemNodeStatus[] = [
    {
      id: "ai_engine",
      label: "AI ENGINE",
      level: engineLevel,
      lastAt: engineLastAt,
      detail: engineLastAt ? `最終実行：記録あり` : "最終実行：なし",
    },
    {
      id: "world_scout",
      label: "WORLD SCOUT",
      level: scoutLevel,
      lastAt: lastScoutAt,
      detail: lastScoutAt ? "最終探索：記録あり" : "最終探索：なし",
    },
    {
      id: "product_hunter",
      label: "PRODUCT HUNTER",
      level: hunterLevel,
      lastAt: hunterLastAt,
      detail: lastDiscoveryAt ? "最終発見：記録あり" : "最終発見：なし",
    },
    {
      id: "ai_posts",
      label: "AI POSTS",
      level: postsLevel,
      lastAt: lastPostAt,
      detail: `今日：${postsToday}件`,
    },
    {
      id: "database",
      label: "DATABASE",
      level: dbOk ? "active" : "error",
      lastAt: dbOk ? new Date(now).toISOString() : null,
      detail: dbOk ? "正常" : "応答なし",
    },
    {
      id: "cron",
      label: "CRON",
      level: cronLevel,
      lastAt: (lastCron?.started_at as string | null) ?? null,
      detail: lastCron ? "実行記録あり" : "実行記録なし（設定だけでは🟢にしない）",
    },
  ];

  const personasRes = await admin
    .from("ai_personas")
    .select(
      "id, profile_id, persona_name, resident_role, country_code, last_active_at, last_action, last_observed_at, discovery_count, interaction_count, activity_level, is_active",
    )
    .eq("is_active", true)
    .order("persona_name", { ascending: true })
    .limit(80);

  const personas = personasRes.error ? [] : (personasRes.data ?? []);
  const profileIds = personas.map((row) => row.profile_id).filter(Boolean);
  const profilesRes = profileIds.length
    ? await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", profileIds)
    : { data: [], error: null };
  const profileMap = new Map(
    (profilesRes.data ?? []).map((row) => [row.id as string, row]),
  );

  const personaIds = personas.map((row) => row.id as string);
  const postsByPersona = new Map<string, number>();
  if (personaIds.length) {
    const postsRes = await admin
      .from("ai_posts")
      .select("persona_id")
      .eq("status", "published")
      .in("persona_id", personaIds)
      .gte("published_at", todayStart);
    for (const row of postsRes.data ?? []) {
      const id = row.persona_id as string;
      postsByPersona.set(id, (postsByPersona.get(id) ?? 0) + 1);
    }
  }

  const reactionByPersona = new Map<string, number>();
  const reactionLogs = await admin
    .from("ai_activity_logs")
    .select("persona_id")
    .eq("action", "reacted")
    .gte("occurred_at", todayStart)
    .limit(500);
  for (const row of reactionLogs.data ?? []) {
    const id = row.persona_id as string | null;
    if (!id) continue;
    reactionByPersona.set(id, (reactionByPersona.get(id) ?? 0) + 1);
  }

  const residents: ResidentTowerRow[] = personas.map((row) => {
    const profile = profileMap.get(row.profile_id as string);
    const lastActionAt =
      (row.last_active_at as string | null) ||
      (row.last_observed_at as string | null);
    const lastAction = (row.last_action as string | null) || null;
    const noAction =
      !lastAction ||
      lastAction.toUpperCase() === "IGNORE" ||
      lastAction.toUpperCase() === "NO_ACTION";
    const level = healthFromFreshness({
      lastAt: lastActionAt,
      activeMs: residentActiveWindowMs(row.activity_level as string),
      lowMs: CONTROL_TOWER_THRESHOLDS.lowActivityNoDiscoveryMs,
      noAction: Boolean(lastActionAt && noAction),
      paused: Boolean(control?.paused),
      now,
    });
    return {
      personaId: row.id as string,
      profileId: row.profile_id as string,
      name:
        (profile?.display_name as string | undefined) ||
        (row.persona_name as string),
      username: (profile?.username as string | null) ?? null,
      role: (row.resident_role as string) || "general_user",
      countryCode: (row.country_code as string | null) ?? null,
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
      level,
      lastActionAt,
      lastAction,
      discoveries: Number(row.discovery_count ?? 0),
      posts: postsByPersona.get(row.id as string) ?? 0,
      reactions: reactionByPersona.get(row.id as string) ?? 0,
      noAction,
    };
  });

  const logsRes = await admin
    .from("ai_activity_logs")
    .select(
      "id, occurred_at, actor_name, actor_role, action, detail, related_product_id, persona_id",
    )
    .order("occurred_at", { ascending: false })
    .limit(40);

  const logs: ActivityLogRow[] = (logsRes.data ?? []).map((row) => ({
    id: row.id as string,
    occurredAt: row.occurred_at as string,
    actorName: (row.actor_name as string) || "system",
    actorRole: (row.actor_role as string) || "",
    action: row.action as string,
    detail: (row.detail as string) || "",
    relatedProductId: (row.related_product_id as string | null) ?? null,
  }));

  const alerts: ControlTowerAlert[] = [];
  if (control?.paused) {
    alerts.push({
      level: "yellow",
      code: "paused",
      message: "AI engine is paused.",
    });
  }
  if (consecutiveFailures >= CONTROL_TOWER_THRESHOLDS.consecutiveFailureAlert) {
    alerts.push({
      level: "red",
      code: "consecutive_failures",
      message: `AI Engine has failed ${consecutiveFailures} consecutive times.`,
    });
  }
  if (hunterRun?.status === "failed") {
    alerts.push({
      level: "red",
      code: "hunter_failed",
      message: `Product Hunter has failed${hunterRun.error ? `: ${hunterRun.error}` : "."}`,
    });
  }
  if (scoutRun?.status === "failed") {
    alerts.push({
      level: "red",
      code: "scout_failed",
      message: `World Scout has failed${scoutRun.error ? `: ${scoutRun.error}` : "."}`,
    });
  }
  if (cronLevel === "stalled") {
    alerts.push({
      level: "red",
      code: "cron_stalled",
      message: "Cron has not produced an execution record within the expected window.",
    });
  }
  if (engineLevel === "stalled") {
    alerts.push({
      level: "red",
      code: "engine_stalled",
      message: "AI Engine has not run within the expected window.",
    });
  }
  const stalledResidents = residents.filter(
    (row) => row.level === "stalled" && row.role !== "world_scout",
  );
  if (stalledResidents.length > 0) {
    alerts.push({
      level: "yellow",
      code: "stalled_residents",
      message: `${stalledResidents.length} resident(s) stalled: ${stalledResidents
        .slice(0, 4)
        .map((row) => row.name)
        .join(", ")}`,
    });
  }
  if (control?.last_error && consecutiveFailures >= 2) {
    alerts.push({
      level: "red",
      code: "repeated_error",
      message: `${errorKindLabel(control.last_error_kind)}: ${control.last_error}`,
    });
  }

  const candidateCount = await countTable("discovery_products");
  const verifiedCount = await countTable("discovery_products", {
    statusIn: ["pending", "approved"],
  });
  const postCount = await countTable("ai_posts", {
    statusEq: "published",
  });

  const running =
    Boolean(control?.running_since) &&
    Date.now() - Date.parse(control?.running_since || "") <
      CONTROL_TOWER_THRESHOLDS.lockStaleMs;

  const agentOs = await loadAgentOsTower({
    paused: Boolean(control?.paused),
    now,
  });

  return {
    generatedAt: new Date(now).toISOString(),
    paused: Boolean(control?.paused),
    running,
    runningSince: control?.running_since ?? null,
    system,
    activity: {
      lastDiscoveryAt,
      lastPostAt,
      lastReactionAt,
      lastScoutRunAt: lastScoutAt,
    },
    today: {
      scouts: todayScouts,
      candidates: typeof todayCandidates.count === "number" ? todayCandidates.count : 0,
      verified: typeof todayVerified.count === "number" ? todayVerified.count : 0,
      posts: postsToday,
      reactions: todayReactions,
      searches: todayScouts,
      errors: todayErrors,
    },
    counters: {
      successfulSearches: todayScouts,
      candidateCount,
      verifiedCount,
      postCount,
      reactionCount: todayReactions,
      errorCount: todayErrors,
      consecutiveFailures,
      noActionCount: todayNoAction,
    },
    lastError: {
      kind: control?.last_error_kind ?? null,
      message: control?.last_error ?? null,
      at: control?.last_error_at ?? null,
    },
    residents,
    logs,
    alerts,
    agentOs,
    cron: {
      lastScheduledAt: (lastCron?.started_at as string | null) ?? null,
      lastSuccessAt: (lastCronSuccess?.started_at as string | null) ?? null,
      lastFailedAt: (lastCronFail?.started_at as string | null) ?? null,
      consecutiveFailures: cronConsecutiveFails,
    },
  };
}
