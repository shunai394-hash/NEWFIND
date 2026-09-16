import {
  getHunterStrategy,
  rotateVocabulary,
  type HunterStrategy,
} from "@/lib/ai/hunter-strategies";
import type { ResidentHumanSignals } from "@/lib/ai/human-signals";
import type { AiPersona } from "@/lib/ai-post-engine";

export type NextHuntHint = {
  theme: string;
  avoid: string[];
  vocabulary: string[];
  strategy: HunterStrategy | null;
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
  const vocabulary = rotateVocabulary(
    strategy,
    `${input.persona.id}:${day}:${input.persona.last_action || ""}`,
    4,
  );
  const avoid = [
    ...(input.recentProductNames ?? []).slice(0, 8),
    ...(input.ignoredNames ?? []).slice(0, 6),
  ];
  const reaction =
    (input.signals?.discoverySuccess ?? 0) >= 40
      ? "deepen successful lane"
      : "leave ignored lane";
  const world = (input.worldHints ?? []).slice(0, 3).join(", ");
  const theme = [
    strategy?.searchStrategy ||
      (input.persona.expertise ?? []).slice(0, 2).join(" / ") ||
      "specialty hunt",
    reaction,
    world ? `world: ${world}` : "",
    vocabulary.length ? `terms: ${vocabulary.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return { theme, avoid, vocabulary, strategy };
}
