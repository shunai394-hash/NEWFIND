import { createAdminClient } from "@/lib/supabase/admin";
import { CONTROL_TOWER_THRESHOLDS } from "./thresholds";
import { classifyErrorKind } from "./errors";
import type {
  EngineRunStatus,
  EngineRunType,
  EngineTrigger,
} from "./types";

type ControlRow = {
  paused: boolean;
  paused_at: string | null;
  paused_reason: string;
  running_since: string | null;
  running_run_id: string | null;
  last_error: string | null;
  last_error_kind: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
};

export type EngineLock =
  | { ok: true; runId: string; paused: boolean }
  | { ok: false; reason: "busy" | "paused" | "unavailable"; message: string };

function isMissingRelation(message: string) {
  return /ai_engine_|42P01|42703/i.test(message);
}

async function ensureControlRow(
  admin: ReturnType<typeof createAdminClient>,
) {
  await admin.from("ai_engine_control").upsert(
    { id: 1, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
}

export async function readEngineControl(): Promise<ControlRow | null> {
  try {
    const admin = createAdminClient();
    await ensureControlRow(admin);
    const { data, error } = await admin
      .from("ai_engine_control")
      .select(
        "paused, paused_at, paused_reason, running_since, running_run_id, last_error, last_error_kind, last_error_at, consecutive_failures",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return null;
      throw new Error(error.message);
    }
    return (data as ControlRow | null) ?? null;
  } catch (error) {
    console.warn("ai_engine_control read failed", error);
    return null;
  }
}

export async function setEnginePaused(paused: boolean, reason = "") {
  const admin = createAdminClient();
  await ensureControlRow(admin);
  const { error } = await admin
    .from("ai_engine_control")
    .update({
      paused,
      paused_at: paused ? new Date().toISOString() : null,
      paused_reason: paused ? reason : "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

function lockIsStale(runningSince: string | null) {
  if (!runningSince) return true;
  const started = Date.parse(runningSince);
  if (!Number.isFinite(started)) return true;
  return Date.now() - started > CONTROL_TOWER_THRESHOLDS.lockStaleMs;
}

export async function acquireEngineLock(input: {
  runType: EngineRunType;
  triggeredBy: EngineTrigger;
  allowWhenPaused?: boolean;
}): Promise<EngineLock> {
  const admin = createAdminClient();
  try {
    await ensureControlRow(admin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingRelation(message)) {
      return { ok: false, reason: "unavailable", message };
    }
    throw error;
  }

  const { data, error } = await admin
    .from("ai_engine_control")
    .select(
      "paused, running_since, running_run_id, consecutive_failures",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error.message)) {
      return { ok: false, reason: "unavailable", message: error.message };
    }
    throw new Error(error.message);
  }

  const row = data as ControlRow | null;
  if (row?.paused && !input.allowWhenPaused) {
    return { ok: false, reason: "paused", message: "AI engine is paused." };
  }

  if (row?.running_since && !lockIsStale(row.running_since)) {
    return {
      ok: false,
      reason: "busy",
      message: "AI engine is already running.",
    };
  }

  const { data: run, error: runError } = await admin
    .from("ai_engine_runs")
    .insert({
      run_type: input.runType,
      status: "running",
      triggered_by: input.triggeredBy,
      started_at: new Date().toISOString(),
      result_summary: {},
    })
    .select("id")
    .single();

  if (runError || !run?.id) {
    if (runError && isMissingRelation(runError.message)) {
      return { ok: false, reason: "unavailable", message: runError.message };
    }
    throw new Error(runError?.message || "Failed to open engine run");
  }

  const { error: lockError } = await admin
    .from("ai_engine_control")
    .update({
      running_since: new Date().toISOString(),
      running_run_id: run.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (lockError) {
    await admin.from("ai_engine_runs").delete().eq("id", run.id);
    throw new Error(lockError.message);
  }

  return { ok: true, runId: run.id, paused: Boolean(row?.paused) };
}

export async function finishEngineRun(input: {
  runId: string;
  status: EngineRunStatus;
  error?: string | null;
  summary?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const finishedAt = new Date().toISOString();
  const errorKind = input.error ? classifyErrorKind(input.error) : null;
  const countsAsFailure = input.status === "failed";

  const { error: runError } = await admin
    .from("ai_engine_runs")
    .update({
      status: input.status,
      finished_at: finishedAt,
      error: input.error ?? null,
      error_kind: errorKind,
      result_summary: input.summary ?? {},
    })
    .eq("id", input.runId);

  if (runError && !isMissingRelation(runError.message)) {
    console.warn("ai_engine_runs finish failed", runError.message);
  }

  const control = await readEngineControl();
  const consecutive = countsAsFailure
    ? (control?.consecutive_failures ?? 0) + 1
    : 0;

  await admin
    .from("ai_engine_control")
    .update({
      running_since: null,
      running_run_id: null,
      last_error: countsAsFailure ? input.error ?? null : control?.last_error ?? null,
      last_error_kind: countsAsFailure
        ? errorKind
        : control?.last_error_kind ?? null,
      last_error_at: countsAsFailure
        ? finishedAt
        : control?.last_error_at ?? null,
      consecutive_failures: consecutive,
      updated_at: finishedAt,
    })
    .eq("id", 1);
}

export async function latestRun(runType?: EngineRunType) {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("ai_engine_runs")
      .select(
        "id, run_type, status, triggered_by, started_at, finished_at, error, error_kind, result_summary",
      )
      .order("started_at", { ascending: false })
      .limit(1);
    if (runType) query = query.eq("run_type", runType);
    const { data, error } = await query.maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return null;
      throw new Error(error.message);
    }
    return data;
  } catch {
    return null;
  }
}

export async function latestFailedRun() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_engine_runs")
      .select("id, run_type, status, started_at, error, error_kind")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return null;
      throw new Error(error.message);
    }
    return data;
  } catch {
    return null;
  }
}

export async function latestCronRuns() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_engine_runs")
      .select(
        "id, run_type, status, triggered_by, started_at, finished_at, error, error_kind",
      )
      .eq("triggered_by", "cron")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) {
      if (isMissingRelation(error.message)) return [];
      throw new Error(error.message);
    }
    return data ?? [];
  } catch {
    return [];
  }
}
