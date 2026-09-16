import { createAdminClient } from "@/lib/supabase/admin";
import { isAgentOsMissing } from "./store";
import type { AgentOsCoverageRow } from "./types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Coverage is derived from existing research runs / sources / findings.
 * Do not add a dedicated coverage table.
 */
export async function loadResearchCoverage(): Promise<AgentOsCoverageRow[]> {
  try {
    const admin = createAdminClient();
    const [agentsRes, runsRes] = await Promise.all([
      admin
        .from("ai_agents")
        .select("id, name, region, beats")
        .order("name", { ascending: true }),
      admin
        .from("ai_research_runs")
        .select(
          "agent_id, status, sources_checked, findings_count, verified_count, rejected_count, duplicate_count",
        )
        .order("started_at", { ascending: false })
        .limit(80),
    ]);

    if (agentsRes.error) {
      if (isAgentOsMissing(agentsRes.error.message)) return [];
      throw new Error(agentsRes.error.message);
    }

    const runs = runsRes.error ? [] : (runsRes.data ?? []);
    const byAgent = new Map<
      string,
      {
        runs: number;
        sources: number;
        findings: number;
        verified: number;
        rejected: number;
        duplicates: number;
        noAction: number;
      }
    >();

    for (const run of runs) {
      const agentId = String(run.agent_id);
      const current = byAgent.get(agentId) ?? {
        runs: 0,
        sources: 0,
        findings: 0,
        verified: 0,
        rejected: 0,
        duplicates: 0,
        noAction: 0,
      };
      current.runs += 1;
      current.sources += Number(run.sources_checked ?? 0);
      current.findings += Number(run.findings_count ?? 0);
      current.verified += Number(run.verified_count ?? 0);
      current.rejected += Number(run.rejected_count ?? 0);
      current.duplicates += Number(run.duplicate_count ?? 0);
      if (run.status === "no_action") current.noAction += 1;
      byAgent.set(agentId, current);
    }

    return (agentsRes.data ?? []).map((agent) => {
      const stats = byAgent.get(agent.id as string) ?? {
        runs: 0,
        sources: 0,
        findings: 0,
        verified: 0,
        rejected: 0,
        duplicates: 0,
        noAction: 0,
      };
      return {
        agentId: agent.id as string,
        name: String(agent.name),
        region: String(agent.region ?? ""),
        beats: asStringArray(agent.beats),
        ...stats,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAgentOsMissing(message)) return [];
    console.warn("research coverage unavailable", message);
    return [];
  }
}
