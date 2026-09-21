import type { ResidentChoice } from "@/lib/ai/self-model";

export const INVESTIGATION_STATUSES = [
  "DISCOVERY",
  "INVESTIGATING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export type InvestigationAdvance = {
  status: InvestigationStatus;
  shouldPost: boolean;
  nextAction: string;
};

const CLOSED: InvestigationStatus[] = ["VERIFIED", "REJECTED", "EXPIRED"];

/**
 * Living-world progression (not a display-only badge):
 * first sight → DISCOVERY
 * re-check / more evidence → INVESTIGATING
 * confirmed → VERIFIED (+ shouldPost)
 * Never jump DISCOVERY→VERIFIED on a single pass.
 */
export function nextInvestigationStatus(input: {
  decision: ResidentChoice;
  previous?: InvestigationStatus | null;
  evidenceCount: number;
  scoresTotal: number;
  qualityOk: boolean;
  qualityReason?: string;
  known?: boolean;
  ageDays?: number;
}): InvestigationAdvance {
  const previous = input.previous ?? null;
  const ageDays = input.ageDays ?? 0;

  if (previous && CLOSED.includes(previous)) {
    return {
      status: previous,
      shouldPost: false,
      nextAction: "closed",
    };
  }

  if (ageDays >= 7 && previous !== "VERIFIED") {
    return {
      status: "EXPIRED",
      shouldPost: false,
      nextAction: "drop stale lead",
    };
  }

  if (!input.qualityOk && input.qualityReason && input.qualityReason !== "LOW_EVIDENCE") {
    return {
      status: "REJECTED",
      shouldPost: false,
      nextAction: `reject: ${input.qualityReason}`,
    };
  }

  if (input.decision === "INVESTIGATE_MORE" || input.qualityReason === "LOW_EVIDENCE") {
    return {
      status: previous === "DISCOVERY" || previous === "INVESTIGATING"
        ? "INVESTIGATING"
        : "DISCOVERY",
      shouldPost: false,
      nextAction: "confirm official sources and a second evidence trail",
    };
  }

  if (input.decision === "IGNORE") {
    return {
      status: previous ? "REJECTED" : "REJECTED",
      shouldPost: false,
      nextAction: "outside beat or not worth the cycle",
    };
  }

  if (input.decision === "WAIT" || input.decision === "OBSERVE") {
    return {
      status: previous ?? "DISCOVERY",
      shouldPost: false,
      nextAction: input.known
        ? "watch for a new angle, do not repeat"
        : "watch this lead",
    };
  }

  // POST / SAVE / DISCOVER / COMMENT / FOLLOW — advance the desk
  const actionable =
    input.decision === "POST" ||
    input.decision === "SAVE" ||
    input.decision === "DISCOVER" ||
    input.decision === "COMMENT" ||
    input.decision === "FOLLOW";

  if (!actionable) {
    return {
      status: previous ?? "DISCOVERY",
      shouldPost: false,
      nextAction: "hold",
    };
  }

  // First sight: always open as DISCOVERY — investigate before posting
  if (!previous) {
    return {
      status: "DISCOVERY",
      shouldPost: false,
      nextAction: "investigate before posting",
    };
  }

  // Second pass from DISCOVERY → INVESTIGATING (need another confirming pass)
  if (previous === "DISCOVERY") {
    const readyToVerify =
      input.qualityOk &&
      (input.evidenceCount >= 2 || input.scoresTotal >= 80);
    if (readyToVerify && input.decision === "POST") {
      // Strong second look can verify in one step from DISCOVERY when evidence piled up
      return {
        status: "VERIFIED",
        shouldPost: true,
        nextAction: "publish verified discovery",
      };
    }
    return {
      status: "INVESTIGATING",
      shouldPost: false,
      nextAction: "confirm official sources and a second evidence trail",
    };
  }

  // INVESTIGATING → VERIFIED when quality holds
  if (previous === "INVESTIGATING") {
    if (input.qualityOk && (input.evidenceCount >= 2 || input.scoresTotal >= 70)) {
      return {
        status: "VERIFIED",
        shouldPost: input.decision === "POST" || input.decision === "SAVE",
        nextAction: "publish follow-up after investigation",
      };
    }
    return {
      status: "INVESTIGATING",
      shouldPost: false,
      nextAction: "keep checking a second source",
    };
  }

  return {
    status: previous ?? "DISCOVERY",
    shouldPost: false,
    nextAction: "hold",
  };
}

export function investigationHeadline(status: InvestigationStatus, title: string) {
  if (status === "DISCOVERY") return `新しい可能性を発見: ${title}`;
  if (status === "INVESTIGATING") return `公式情報を確認中: ${title}`;
  if (status === "VERIFIED") return `確認できた発見: ${title}`;
  if (status === "REJECTED") return `見送り: ${title}`;
  return `期限切れ: ${title}`;
}
