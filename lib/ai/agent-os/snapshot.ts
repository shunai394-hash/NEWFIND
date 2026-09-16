import { createAdminClient } from "@/lib/supabase/admin";
import { CONTROL_TOWER_THRESHOLDS } from "@/lib/ai/control-tower/thresholds";
import { isAgentOsMissing } from "./store";
import type { AgentOsTower, AgentStatus } from "./types";
import { EMPTY_AGENT_OS_TOWER } from "./types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function deriveStatus(input: {
  stored: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  paused: boolean;
  now: number;
}): AgentStatus {
  if (input.paused || input.stored === "paused") return "paused";
  if (input.stored === "error" || input.lastRunStatus === "failed") return "error";
  if (!input.lastRunAt) {
    return input.stored === "active" ? "active" : (input.stored as AgentStatus);
  }
  const then = Date.parse(input.lastRunAt);
  if (
    Number.isFinite(then) &&
    input.now - then > CONTROL_TOWER_THRESHOLDS.scoutActiveMs
  ) {
    return "stalled";
  }
  return input.stored === "stalled" ? "stalled" : "active";
}

export async function loadAgentOsTower(input: {
  paused: boolean;
  now?: number;
}): Promise<AgentOsTower> {
  const now = input.now ?? Date.now();
  try {
    const admin = createAdminClient();
    const [
      agentsRes,
      runsRes,
      missionsRes,
      sourcesRes,
      findingsRes,
      verifiedRes,
      duplicateRes,
      pendingRes,
      completedRes,
      failedRes,
      handoffsRes,
    ] = await Promise.all([
        admin
          .from("ai_agents")
          .select(
            "id, name, type, role, region, country_code, beats, status, last_run_at, last_action_at",
          )
          .order("name", { ascending: true }),
        admin
          .from("ai_research_runs")
          .select(
            "id, agent_id, mission_id, started_at, status, sources_checked, findings_count, verified_count, duplicate_count, metadata",
          )
          .order("started_at", { ascending: false })
          .limit(12),
        admin
          .from("ai_missions")
          .select("id, agent_id, objective, is_active"),
        admin
          .from("ai_research_sources")
          .select("id", { count: "exact", head: true }),
        admin.from("ai_findings").select("id", { count: "exact", head: true }),
        admin
          .from("ai_findings")
          .select("id", { count: "exact", head: true })
          .eq("status", "verified"),
        admin
          .from("ai_findings")
          .select("id", { count: "exact", head: true })
          .eq("status", "duplicate"),
        admin
          .from("ai_handoffs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        admin
          .from("ai_handoffs")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        admin
          .from("ai_handoffs")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed"),
        admin
          .from("ai_handoffs")
          .select(
            "id, status, reason, created_at, from_agent_id, to_persona_id, finding_id",
          )
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    if (agentsRes.error) {
      if (isAgentOsMissing(agentsRes.error.message)) return EMPTY_AGENT_OS_TOWER;
      throw new Error(agentsRes.error.message);
    }

    const agents = agentsRes.data ?? [];
    const runs = runsRes.data ?? [];
    const missions = missionsRes.data ?? [];
    const agentName = new Map(agents.map((row) => [row.id as string, String(row.name)]));
    const missionByAgent = new Map<string, string>();
    for (const mission of missions) {
      if (!mission.is_active) continue;
      if (!missionByAgent.has(mission.agent_id as string)) {
        missionByAgent.set(
          mission.agent_id as string,
          String(mission.objective ?? ""),
        );
      }
    }

    const lastRunByAgent = new Map<string, (typeof runs)[number]>();
    for (const run of runs) {
      const agentId = run.agent_id as string;
      if (!lastRunByAgent.has(agentId)) lastRunByAgent.set(agentId, run);
    }

    const handoffRows = handoffsRes.error ? [] : (handoffsRes.data ?? []);

    const personaIds = [
      ...new Set(
        handoffRows
          .map((row) => row.to_persona_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const personas = personaIds.length
      ? await admin
          .from("ai_personas")
          .select("id, persona_name")
          .in("id", personaIds)
      : { data: [], error: null };
    const personaName = new Map(
      (personas.data ?? []).map((row) => [row.id as string, String(row.persona_name)]),
    );

    return {
      agents: agents.map((row) => {
        const last = lastRunByAgent.get(row.id as string);
        const lastRunAt = (row.last_run_at as string | null) ?? null;
        const lastRunStatus = (last?.status as string | null) ?? null;
        return {
          agentId: row.id as string,
          name: String(row.name),
          type: String(row.type),
          role: String(row.role),
          region: String(row.region ?? ""),
          countryCode: (row.country_code as string | null) ?? null,
          beats: asStringArray(row.beats),
          status: deriveStatus({
            stored: String(row.status ?? "active"),
            lastRunAt,
            lastRunStatus,
            paused: input.paused,
            now,
          }),
          lastRunAt,
          lastActionAt: (row.last_action_at as string | null) ?? null,
          lastRunStatus,
        };
      }),
      runs: runs.slice(0, 8).map((run) => ({
        id: run.id as string,
        agentName: agentName.get(run.agent_id as string) || "unknown",
        missionObjective:
          ((run.metadata as { objective?: string } | null)?.objective ??
            missionByAgent.get(run.agent_id as string)) ||
          null,
        startedAt: run.started_at as string,
        status: String(run.status),
        sourcesChecked: Number(run.sources_checked ?? 0),
        findingsCount: Number(run.findings_count ?? 0),
        verifiedCount: Number(run.verified_count ?? 0),
        duplicateCount: Number(run.duplicate_count ?? 0),
      })),
      research: {
        sources: typeof sourcesRes.count === "number" ? sourcesRes.count : 0,
        findings: typeof findingsRes.count === "number" ? findingsRes.count : 0,
        verified: typeof verifiedRes.count === "number" ? verifiedRes.count : 0,
        duplicates: typeof duplicateRes.count === "number" ? duplicateRes.count : 0,
      },
      handoff: {
        pending: typeof pendingRes.count === "number" ? pendingRes.count : 0,
        completed: typeof completedRes.count === "number" ? completedRes.count : 0,
        failed: typeof failedRes.count === "number" ? failedRes.count : 0,
        recent: handoffRows.map((row) => ({
          id: row.id as string,
          fromAgent: agentName.get(row.from_agent_id as string) || "unknown",
          toName:
            personaName.get(row.to_persona_id as string) ||
            (row.status === "pending" ? "unassigned" : "resident"),
          findingTitle: String(row.reason ?? ""),
          status: String(row.status),
          createdAt: row.created_at as string,
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return EMPTY_AGENT_OS_TOWER;
    console.warn("agent os tower load failed", message);
    return EMPTY_AGENT_OS_TOWER;
  }
}
