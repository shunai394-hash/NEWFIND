import type { DiscoveryReport } from "@/lib/ai/discovery-report";
import { clampScore } from "@/lib/ai/discovery-report";
import { generateAIText } from "@/lib/ai/groq";
import { parseAIJson } from "@/lib/ai/brain";
import type { AiPersona } from "@/lib/ai-post-engine";

export type EditorialVerdict = {
  post: boolean;
  criticScore: number;
  curatorScore: number;
  reasons: string[];
};

function heuristicVerdict(report: DiscoveryReport): EditorialVerdict {
  const reasons: string[] = [];
  if (report.evidenceScore < 50) reasons.push("evidence too thin");
  if (report.duplicateRisk >= 80) reasons.push("already in the world");
  if (report.residentFitScore < 45) reasons.push("weak resident fit");
  if (report.humanInterestScore < 35) reasons.push("low human discovery value");
  if (!report.whyNow.trim()) reasons.push("no why-now");
  if (!report.whyThisResident.trim()) reasons.push("no resident reason");

  const criticScore = clampScore(
    100 -
      report.duplicateRisk * 0.4 -
      (50 - Math.min(report.evidenceScore, 50)) -
      (report.whyNow ? 0 : 15),
  );
  const curatorScore = clampScore(
    (report.humanInterestScore + report.noveltyScore + report.residentFitScore) /
      3,
  );
  const post =
    reasons.length === 0 &&
    criticScore >= 55 &&
    curatorScore >= 50 &&
    report.confidenceScore >= 55;
  return { post, criticScore, curatorScore, reasons };
}

export async function reviewDiscoveryForPost(input: {
  report: DiscoveryReport;
  hunter: AiPersona;
  critic?: AiPersona | null;
  curator?: AiPersona | null;
}): Promise<EditorialVerdict> {
  const base = heuristicVerdict(input.report);
  if (!base.post) return base;
  if (!input.critic && !input.curator) return base;

  try {
    const raw = await generateAIText(
      [
        "You are the NEWFIND editorial board made of a Critic and a Curator.",
        "Decide if a hunter discovery should be posted today.",
        "Never invent facts. Use only the report.",
        `Hunter: ${input.hunter.persona_name} / ${input.hunter.resident_role}`,
        `Critic lens: ${input.critic?.personality || "is it new, concrete, evidenced, not duplicate, and why this resident?"}`,
        `Curator lens: ${input.curator?.personality || "does it belong in today's NEWFIND for humans?"}`,
        "Report JSON:",
        JSON.stringify(input.report),
        'Return JSON only: {"post":true,"criticScore":0,"curatorScore":0,"reasons":["..."]}',
        "Scores 0-100. post=false if evidence is thin, duplicate, generic, or off-specialty.",
      ].join("\n"),
      { temperature: 0.2, maxTokens: 400 },
    );
    const parsed = parseAIJson<{
      post?: unknown;
      criticScore?: unknown;
      curatorScore?: unknown;
      reasons?: unknown;
    }>(raw);
    if (!parsed) return base;
    const criticScore = clampScore(Number(parsed.criticScore ?? base.criticScore));
    const curatorScore = clampScore(
      Number(parsed.curatorScore ?? base.curatorScore),
    );
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((item) => String(item)).filter(Boolean)
      : base.reasons;
    const post =
      parsed.post === true &&
      criticScore >= 55 &&
      curatorScore >= 50 &&
      reasons.length < 3;
    return { post, criticScore, curatorScore, reasons };
  } catch (error) {
    console.error("editorial board skipped after API failure", error);
    return base;
  }
}
