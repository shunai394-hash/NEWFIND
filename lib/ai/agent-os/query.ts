/**
 * Common Research query strategy.
 * Agent-specific input is mission context (region / beats / objective).
 * Keep query count capped so existing cron and search rate limits stay intact.
 */

export type ResearchMissionContext = {
  region: string;
  countryCode?: string | null;
  beats: string[];
  objective?: string | null;
  language?: string | null;
  seed: string;
  recentQueries?: string[];
  personaTerms?: string[];
  maxQueries?: number;
};

export type PlannedResearchQuery = {
  beat: string;
  query: string;
  language: string;
  label: "primary" | "explore";
};

const MAX_QUERIES = 2;
const JUNK_NEGATIVES = "-pinterest -aliexpress";

const BEAT_PHRASES: Record<string, string[]> = {
  product: ["new product official", "independent brand product page"],
  food: ["new food brand official", "craft food product"],
  beauty: ["new skincare product", "independent perfume official"],
  fashion: ["new collection official product", "independent fashion product"],
  culture: ["new independent brand", "new community app official"],
  trend: ["emerging brand 2026", "rising independent product"],
  company: ["company official site", "startup announcement official"],
  market: ["industry news official", "market report official"],
};

const REGION_QUERY: Record<string, string> = {
  JP: "Japan",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  KR: "Korea",
  IT: "Italy",
};

function rotate<T>(items: T[], seed: string) {
  if (items.length === 0) return items;
  const index =
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function regionToken(context: ResearchMissionContext) {
  const code = (context.countryCode || "").trim().toUpperCase();
  if (code && REGION_QUERY[code]) return REGION_QUERY[code];
  return context.region.trim() || code;
}

function phrasesForBeat(beat: string) {
  const known = BEAT_PHRASES[beat];
  if (known?.length) return known;
  return [`${beat} official`, `${beat} product page`];
}

function pickPhrase(beat: string, seed: string, recentQueries: string[]) {
  const phrases = rotate(phrasesForBeat(beat), `${seed}:${beat}`);
  const unused = phrases.find(
    (phrase) => !recentQueries.some((query) => query.includes(phrase)),
  );
  return unused ?? phrases[0] ?? beat;
}

export function planResearchQueries(
  context: ResearchMissionContext,
): PlannedResearchQuery[] {
  const max = Math.max(1, Math.min(context.maxQueries ?? MAX_QUERIES, MAX_QUERIES));
  const beats = rotate(context.beats.filter(Boolean), context.seed).slice(0, max);
  const region = regionToken(context);
  const language = (context.language || "en").slice(0, 2);
  const recent = context.recentQueries ?? [];
  const personaTerms = (context.personaTerms ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 3);

  return beats.map((beat, index) => {
    const phrase = pickPhrase(beat, context.seed, recent);
    const persona = personaTerms[index] || personaTerms[0] || "";
    return {
      beat,
      query: `${phrase} ${persona} ${region} ${JUNK_NEGATIVES}`
        .replace(/\s+/g, " ")
        .trim(),
      language,
      label: index === 0 ? "primary" : "explore",
    };
  });
}
