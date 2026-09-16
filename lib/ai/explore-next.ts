import {
  getHunterStrategy,
  preferredSearchDomains,
  rotateVocabulary,
  type HunterStrategy,
} from "@/lib/ai/hunter-strategies";
import type { ResidentHumanSignals } from "@/lib/ai/human-signals";
import { huntModeFromSignals } from "@/lib/ai/human-signals";
import type { AiPersona } from "@/lib/ai-post-engine";

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
}): NextHuntHint {
  const strategy = getHunterStrategy(input.persona.username);
  const day = new Date().toISOString().slice(0, 10);
  const mode = huntModeFromSignals(input.signals);
  const vocabSkip = mode === "leave" ? 3 : mode === "explore" ? 1 : 0;
  const vocabulary = rotateVocabulary(
    strategy,
    `${input.persona.id}:${day}`,
    3,
    vocabSkip,
  );
  const preferred = preferredSearchDomains(strategy);
  const includeDomains =
    mode === "leave"
      ? []
      : mode === "deepen"
        ? preferred
        : preferred.slice(0, 2);
  const avoid = [
    ...(input.recentProductNames ?? []).slice(0, 8),
    ...(input.ignoredNames ?? []).slice(0, 6),
  ];
  const reaction =
    mode === "deepen"
      ? "deepen successful lane"
      : mode === "leave"
        ? "leave ignored lane"
        : "explore unused lane";
  const world = (input.worldHints ?? []).slice(0, 3).join(", ");
  const theme = [
    strategy?.searchStrategy ||
      (input.persona.expertise ?? []).slice(0, 2).join(" / ") ||
      "specialty hunt",
    reaction,
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
