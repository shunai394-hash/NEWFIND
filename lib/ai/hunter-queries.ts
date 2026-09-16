import {
  getHunterStrategy,
  preferredSearchDomains,
  rotateVocabulary,
  type HunterStrategy,
} from "@/lib/ai/hunter-strategies";
import type { NextHuntHint } from "@/lib/ai/explore-next";
import type { WorldSearchQuery } from "@/lib/ai/world-search";
import { buildResidentSearchQuery } from "@/lib/ai/world-search";

export type PrecisionHuntQuery = WorldSearchQuery & {
  label: "primary" | "source" | "explore";
};

const JUNK_NEGATIVES = "-pinterest -aliexpress";

function compactQuery(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function regionToken(bias?: string): string {
  if (!bias) return "";
  const head = (bias.split(/[\s/]/)[0] || "").toUpperCase();
  const map: Record<string, string> = {
    JP: "Japan",
    KR: "Korea",
    IT: "Italy",
    FR: "France",
    SE: "Nordic",
    DK: "Nordic",
    US: "US",
    EU: "Europe",
    TW: "Taiwan",
    NL: "Netherlands",
    DE: "Germany",
    CA: "Canada",
    ES: "Spain",
    PT: "Portugal",
    SG: "Singapore",
    TH: "Thailand",
  };
  return map[head] || "";
}

function pdpIntent(language?: string): string {
  const ja = (language || "").toLowerCase().startsWith("ja");
  return ja ? "公式 商品ページ" : '"product" buy';
}

export function huntQueryIsFocused(query: string): boolean {
  const words = query
    .replace(/[^\p{L}\p{N}"+-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= 14;
}

export function buildPrecisionHuntQueries(input: {
  residentName: string;
  interests: string[];
  preferredCategories: string[];
  goals: string[];
  expertise?: string[];
  values?: string[];
  country?: string | null;
  language?: string;
  favoriteBrands?: string[];
  region?: string | null;
  discoveryKeywords?: string[];
  huntingSpecialty?: string;
  username?: string | null;
  nextHunt?: NextHuntHint | null;
  strategy?: HunterStrategy | null;
}): PrecisionHuntQuery[] {
  const strategy =
    input.strategy ?? getHunterStrategy(input.username);
  const language = input.language;
  const ja = (language || "").toLowerCase().startsWith("ja");
  const focusTerms = (
    input.nextHunt?.vocabulary?.length
      ? input.nextHunt.vocabulary
      : rotateVocabulary(strategy, `${input.username || input.residentName}:hunt`, 3)
  ).slice(0, 3);
  const keywords = [
    ...focusTerms,
    ...(input.discoveryKeywords ?? []).slice(0, 2),
  ];
  const base = buildResidentSearchQuery({
    residentName: input.residentName,
    interests: input.interests,
    preferredCategories: input.preferredCategories,
    goals: input.goals,
    expertise: input.expertise,
    values: input.values,
    country: input.country,
    language,
    favoriteBrands: input.favoriteBrands,
    region: input.region,
    discoveryKeywords: keywords,
    huntingSpecialty: input.huntingSpecialty,
  });

  const v0 = focusTerms[0] || keywords[0] || "product";
  const v1 = focusTerms[1] || v0;
  const v2 = focusTerms[2] || v1;
  const mode = input.nextHunt?.mode ?? "explore";
  const domains =
    mode === "leave"
      ? []
      : input.nextHunt?.includeDomains ?? preferredSearchDomains(strategy);

  const primary: PrecisionHuntQuery = {
    ...base,
    query: compactQuery([
      v0,
      v1,
      pdpIntent(language),
      regionToken(strategy?.regionBias),
      strategy?.newnessPreference === "launch" ? (ja ? "新作" : "new") : "",
      JUNK_NEGATIVES,
    ]),
    label: "primary",
  };

  const source: PrecisionHuntQuery = {
    ...base,
    query: compactQuery([
      v0,
      ja ? "商品" : "product",
      "buy",
    ]),
    includeDomains: domains.length ? domains : undefined,
    label: domains.length ? "source" : "explore",
  };
  if (!domains.length) {
    source.query = compactQuery([
      v1,
      "sku",
      pdpIntent(language),
      JUNK_NEGATIVES,
    ]);
    source.label = "explore";
  }

  const explore: PrecisionHuntQuery = {
    ...base,
    query: compactQuery([
      v2,
      mode === "deepen"
        ? ja
          ? "公式"
          : "official"
        : strategy?.brandSize === "indie"
          ? "independent brand"
          : ja
            ? "新作"
            : "new",
      pdpIntent(language),
      JUNK_NEGATIVES,
    ]),
    label: "explore",
  };

  return [primary, source, explore];
}
