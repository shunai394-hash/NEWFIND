/**
 * Dry-run one living-world resident cycle focusing on
 * explore → discovery desk → investigate → verified subject → social.
 * Pass --apply to write (default is dry-run).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getActiveAiPersonas } from "../lib/ai-post-engine";
import { runResidentLifeCycle } from "../lib/ai/resident-life";
import { getSharedWorldNews } from "../lib/ai/gdelt";
import { getGoogleTrendsForWorld, type GoogleTrend } from "../lib/ai/google-trends";
import type { WorldSearchResult } from "../lib/ai/world-search";
import { upsertInvestigation } from "../lib/ai/investigations";

async function forceDeskProgression(
  persona: Awaited<ReturnType<typeof getActiveAiPersonas>>[number],
  apply: boolean,
) {
  const { nextInvestigationStatus } = await import("../lib/ai/investigation-status");
  const title = `Lifecycle verify ${new Date().toISOString().slice(0, 16)}`;
  const url = `https://example.com/newfind-lifecycle-${Date.now()}`;

  // Deterministic in-memory chain (always) — proves the status machine.
  const mem1 = nextInvestigationStatus({
    decision: "DISCOVER",
    previous: null,
    evidenceCount: 1,
    scoresTotal: 55,
    qualityOk: true,
  });
  const mem2 = nextInvestigationStatus({
    decision: "INVESTIGATE_MORE",
    previous: mem1.status,
    evidenceCount: 2,
    scoresTotal: 60,
    qualityOk: true,
    qualityReason: "LOW_EVIDENCE",
  });
  const mem3 = nextInvestigationStatus({
    decision: "POST",
    previous: mem2.status,
    evidenceCount: 3,
    scoresTotal: 85,
    qualityOk: true,
  });

  const base = {
    personaId: persona.id,
    profileId: persona.profile_id,
    actorName: persona.display_name || persona.persona_name,
    actorRole: persona.resident_role || "media",
    title,
    summary: "Manual lifecycle verification lead",
    beat: "beauty",
    city: persona.region || "Tokyo",
    correspondentTitle: persona.persona_name,
    sourceUrl: url,
    sourceTitle: title,
    sourceKind: "NEWS",
    dryRun: !apply,
  } as const;

  const pass1 = await upsertInvestigation({
    ...base,
    decision: "DISCOVER",
    evidenceCount: 1,
    confidence: 55,
    qualityOk: true,
  });
  const pass2 = await upsertInvestigation({
    ...base,
    decision: "INVESTIGATE_MORE",
    evidenceCount: 1,
    confidence: 60,
    qualityOk: true,
    qualityReason: "LOW_EVIDENCE",
  });
  const pass3 = await upsertInvestigation({
    ...base,
    decision: "POST",
    evidenceCount: 1,
    confidence: 85,
    qualityOk: true,
  });

  return {
    title,
    url,
    apply,
    memoryChain: [
      { n: 1, status: mem1.status, shouldPost: mem1.shouldPost },
      { n: 2, status: mem2.status, shouldPost: mem2.shouldPost },
      { n: 3, status: mem3.status, shouldPost: mem3.shouldPost },
    ],
    dbPasses: [
      { n: 1, status: pass1.status, shouldPost: pass1.shouldPost, recordId: pass1.record?.id ?? null },
      { n: 2, status: pass2.status, shouldPost: pass2.shouldPost, recordId: pass2.record?.id ?? null },
      { n: 3, status: pass3.status, shouldPost: pass3.shouldPost, recordId: pass3.record?.id ?? null },
    ],
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const personas = await getActiveAiPersonas();
  const media =
    personas.find((p) => p.resident_role === "media") ||
    personas.find((p) => p.resident_role === "critic") ||
    personas.find((p) => (p.interests ?? []).length > 0) ||
    personas[0];

  if (!media) {
    throw new Error("No active AI persona found");
  }

  console.log(
    `Running lifecycle for ${media.persona_name} (${media.resident_role}) dryRun=${dryRun}`,
  );

  const desk = await forceDeskProgression(media, apply);
  console.log("DESK_PROGRESSION", JSON.stringify(desk, null, 2));

  let worldNews: WorldSearchResult[] = [];
  let trends: GoogleTrend[] = [];
  try {
    worldNews = await getSharedWorldNews();
  } catch (error) {
    console.warn("world news skipped", error instanceof Error ? error.message : error);
  }
  try {
    trends = await getGoogleTrendsForWorld(["JP", "US", "GB", "KR"], 6);
  } catch (error) {
    console.warn("trends skipped", error instanceof Error ? error.message : error);
  }

  const result = await runResidentLifeCycle(media, worldNews, trends, {
    dryRun,
    runId: crypto.randomUUID(),
  });

  console.log(
    JSON.stringify(
      {
        persona: result.persona,
        role: result.residentRole,
        mind: result.mind,
        work: result.action.work,
        social: result.action.social,
        correspondent: result.correspondent
          ? {
              beat: result.correspondent.beat.primary,
              city: result.correspondent.city,
              scanned: result.correspondent.scanned,
              accepted: result.correspondent.accepted.length,
              investigating: result.correspondent.investigating.length,
              query: result.correspondent.query,
            }
          : null,
        observation: result.observation.reason,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
