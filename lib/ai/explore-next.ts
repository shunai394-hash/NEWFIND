import type { AiPersona } from "@/lib/ai-post-engine";
import {
  getHunterStrategy,
  preferredSearchDomains,
  rotateVocabulary,
  type HunterStrategy,
} from "@/lib/ai/hunter-strategies";
import type { ResidentHumanSignals } from "@/lib/ai/human-signals";
import { huntModeFromSignals } from "@/lib/ai/human-signals";
import type { Intent } from "@/lib/ai/self-model";

export type NextHuntHint = {
  theme: string;
  avoid: string[];
  vocabulary: string[];
  strategy: HunterStrategy | null;
  mode: "deepen" | "leave" | "explore";
  includeDomains: string[];
};

export function planNextHunt(input: {
  persona: AiPersona;
  signals?: ResidentHumanSignals | null;
  recentProductNames?: string[];
  ignoredNames?: string[];
  worldHints?: string[];
  intent?: Intent | null;
}): NextHuntHint {
  const strategy = getHunterStrategy(input.persona.username);
  const day = new Date().toISOString().slice(0, 10);
  const mode = huntModeFromSignals(input.signals);
  const vocabSkip = mode === "leave" ? 3 : mode === "explore" ? 1 : 0;
  const vocabulary = (
    input.intent?.terms?.length
      ? input.intent.terms
      : rotateVocabulary(
          strategy,
          `${input.persona.id}:${day}`,
          3,
          vocabSkip,
        )
  ).slice(0, 3);
  const preferred = preferredSearchDomains(strategy);
  const includeDomains =
    mode === "leave"
      ? []
      : mode === "deepen"
        ? preferred
        : preferred.slice(0, 2);
  const avoid = [
    ...(input.intent?.avoid ?? []),
    ...(input.recentProductNames ?? []).slice(0, 8),
    ...(input.ignoredNames ?? []).slice(0, 6),
  ];
  const reaction =
    input.intent?.stance === "investigate"
      ? "investigate previous thin evidence"
      : mode === "deepen"
      ? "deepen successful lane"
      : mode === "leave"
        ? "leave ignored lane"
        : "explore unused lane";
  const world = (input.worldHints ?? []).slice(0, 3).join(", ");
  const theme = [
    input.intent?.focus ||
      strategy?.searchStrategy ||
      (input.persona.expertise ?? []).slice(0, 2).join(" / ") ||
      "specialty hunt",
    input.intent?.why || reaction,
    includeDomains.length
      ? `domains: ${includeDomains.join(",")}`
      : "domains: open-web",
    world ? `world: ${world}` : "",
    vocabulary.length ? `terms: ${vocabulary.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return { theme, avoid, vocabulary, strategy, mode, includeDomains };
}
