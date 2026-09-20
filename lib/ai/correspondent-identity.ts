/**
 * Canonical correspondent identity for NEWFIND residents.
 * Source of truth is persona/catalog data, never LLM output.
 * Existing resident_role is kept; this is an overlay, not a replacement.
 */

import { lookupNamedWorldResident, listNamedWorldResidents } from "@/lib/ai/named-world-residents";
import { countryName, flagEmoji } from "@/lib/world/labels";

export type CorrespondentIdentity = {
  username: string;
  displayName: string;
  englishName: string;
  title: string;
  titleJa: string;
  role: string;
  countryCode: string;
  countryName: string;
  city: string;
  territories: string[];
  primaryBeat: string;
  specialties: string[];
  subSpecialties: string[];
  mission: string;
  intro: string;
  reportingStance: string;
  searchTerms: string[];
  flag: string;
};

export type CorrespondentLensInput = {
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  role?: string | null;
  expertise?: string[] | null;
  interests?: string[] | null;
  preferredCategories?: string[] | null;
  huntingSpecialty?: string | null;
  countryCode?: string | null;
  region?: string | null;
  languages?: string[] | null;
  goals?: string[] | null;
  bio?: string | null;
};

const CITY_FOR_COUNTRY: Record<string, string> = {
  JP: "Tokyo",
  KR: "Seoul",
  GB: "London",
  UK: "London",
  US: "New York",
  FR: "Paris",
  IT: "Milan",
  DE: "Berlin",
  SE: "Stockholm",
  SG: "Singapore",
  CA: "Vancouver",
  NL: "Amsterdam",
  TW: "Taipei",
  TH: "Bangkok",
  PT: "Porto",
  AU: "Sydney",
  CN: "Shanghai",
};

const BEAT_EN: Record<string, string> = {
  beauty: "Beauty",
  fashion: "Fashion",
  tech: "Tech",
  food: "Food",
  home: "Home",
  travel: "Travel",
  outdoor: "Outdoor",
  gaming: "Gaming",
  music: "Music",
  entertainment: "Entertainment",
  design: "Design",
  culture: "Culture",
  wellness: "Wellness",
  parenting: "Parenting",
  pets: "Pets",
  sustainability: "Sustainability",
  "japanese products": "Japan Brand",
  "overseas products": "Overseas Products",
  marketplace: "Marketplace",
};

const BEAT_JA: Record<string, string> = {
  beauty: "美容",
  fashion: "ファッション",
  tech: "テック",
  food: "食",
  home: "暮らし",
  culture: "カルチャー",
  wellness: "ウェルネス",
  "japanese products": "日本ブランド",
  "overseas products": "海外商品",
  marketplace: "マーケットプレイス",
};

const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  KR: "Korea",
  GB: "UK",
  US: "US",
  FR: "France",
  IT: "Italy",
  DE: "Germany",
  SE: "Sweden",
  SG: "Singapore",
  CA: "Canada",
  NL: "Netherlands",
  TW: "Taiwan",
  TH: "Thailand",
  PT: "Portugal",
};

function compact(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    const folded = key.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(key);
  }
  return out;
}

function detectBeat(pool: string) {
  const aliases: Array<[string, string]> = [
    ["sneaker", "fashion"],
    ["skincare", "beauty"],
    ["cosmetics", "beauty"],
    ["k-beauty", "beauty"],
    ["fragrance", "beauty"],
    ["beauty", "beauty"],
    ["streetwear", "fashion"],
    ["fashion", "fashion"],
    ["gadget", "tech"],
    ["tech", "tech"],
    ["food", "food"],
    ["wellness", "wellness"],
    ["home", "home"],
    ["outdoor", "outdoor"],
    ["travel", "travel"],
    ["pet", "pets"],
    ["japan", "japanese products"],
    ["overseas", "overseas products"],
    ["auction", "marketplace"],
    ["mercari", "marketplace"],
    ["ebay", "marketplace"],
    ["amazon", "marketplace"],
    ["culture", "culture"],
  ];
  for (const [needle, beat] of aliases) {
    if (pool.includes(needle)) return beat;
  }
  return "culture";
}

function cityFor(countryCode: string, region?: string | null) {
  const regionValue = (region || "").trim();
  const country = countryCode.toUpperCase();
  const countryLabel = COUNTRY_NAMES[country] || countryName(country);
  if (
    regionValue &&
    !/^(japan|korea|uk|usa|us|france|italy|germany|europe)$/i.test(regionValue) &&
    regionValue.toLowerCase() !== (countryLabel || "").toLowerCase()
  ) {
    return regionValue;
  }
  return CITY_FOR_COUNTRY[country] || regionValue || countryLabel || "World";
}

function territoriesFor(countryCode: string, beat: string, city: string) {
  const home = COUNTRY_NAMES[countryCode] || countryName(countryCode) || city;
  const extra =
    beat === "beauty"
      ? ["Korea", "Japan", "US"]
      : beat === "fashion"
        ? ["Europe", "US", "Japan"]
        : beat === "tech"
          ? ["US", "Japan", "Europe"]
          : beat === "japanese products"
            ? ["Japan"]
            : beat === "overseas products"
              ? ["US", "Europe", "Asia"]
              : [home, "Japan"];
  return unique([home, city, ...extra]).slice(0, 4);
}

function titleFor(input: {
  city: string;
  countryCode: string;
  beat: string;
  specialties: string[];
}) {
  const pool = input.specialties.join(" ").toLowerCase();
  const beatEn = BEAT_EN[input.beat] || "Culture";
  if (input.countryCode === "KR" && input.beat === "beauty") {
    return `${input.city} K-Beauty Correspondent`;
  }
  if (input.beat === "japanese products" || /日本商品|japan brand/.test(pool)) {
    return `${input.city} Japan Brand Correspondent`;
  }
  if (/sneaker/.test(pool)) {
    const short = input.city === "New York" ? "NY" : input.city;
    return `${short} Sneaker Correspondent`;
  }
  if (input.city === "New York") return `NY ${beatEn} Correspondent`;
  return `${input.city} ${beatEn} Correspondent`;
}

function titleJaFor(title: string, city: string, beat: string) {
  const beatJa = BEAT_JA[beat] || beat;
  if (/K-Beauty/.test(title)) return `${city} K-Beauty特派員`;
  if (/Japan Brand/.test(title)) return `${city}・日本ブランド特派員`;
  if (/Sneaker/.test(title)) return `${city}スニーカー特派員`;
  return `${city}${beatJa}特派員`;
}

export function correspondentIdentityFromLens(
  input: CorrespondentLensInput,
): CorrespondentIdentity {
  const named = lookupNamedWorldResident(input.username);
  const username = (input.username || named?.username || "").toLowerCase();
  const displayName =
    input.displayName ||
    input.name ||
    named?.displayName ||
    named?.personaName ||
    "Resident";
  const role = input.role || named?.residentRole || "general_user";
  const countryCode = (
    input.countryCode ||
    named?.countryCode ||
    "US"
  ).toUpperCase();
  const region = input.region || named?.region || "";
  const city = cityFor(countryCode, region);
  const expertise = input.expertise?.length ? input.expertise : named?.expertise ?? [];
  const interests = input.interests?.length ? input.interests : named?.interests ?? [];
  const hunting = input.huntingSpecialty || named?.huntingSpecialty || "";
  const pool = compact(
    [hunting, ...expertise, ...interests, ...(input.preferredCategories ?? []), username].join(" "),
  );
  const primaryBeat = detectBeat(pool);
  const specialties = unique([
    BEAT_EN[primaryBeat] || primaryBeat,
    ...expertise.slice(0, 4),
  ]).slice(0, 4);
  const subSpecialties = unique(
    interests.filter((item) => compact(item) !== compact(primaryBeat)),
  ).slice(0, 3);
  const territories = territoriesFor(countryCode, primaryBeat, city);
  const title = titleFor({ city, countryCode, beat: primaryBeat, specialties: [...specialties, hunting] });
  const titleJa = titleJaFor(title, city, primaryBeat);
  const countryLabel = COUNTRY_NAMES[countryCode] || countryName(countryCode) || countryCode;
  const mission =
    (input.goals ?? named?.goals ?? [])[0] ||
    `${city}と${territories.slice(0, 2).join(" / ")}の${specialties[0]}を取材し、NEWFINDのユーザーへ届ける。`;
  const intro =
    input.bio ||
    named?.bio ||
    `${city}を拠点に、${territories.join(" / ")}で注目されている${specialties.join(" / ")}を取材しています。`;
  const reportingStance =
    countryCode === "JP"
      ? "日本市場への意味と、世界への発信"
      : `${city}現地の動きと、日本のユーザーが知る価値`;
  const searchTerms = unique([
    city,
    countryLabel,
    primaryBeat,
    ...specialties.slice(0, 2),
    ...subSpecialties.slice(0, 2),
  ]).slice(0, 6);

  return {
    username,
    displayName,
    englishName: displayName,
    title,
    titleJa,
    role,
    countryCode,
    countryName: countryLabel,
    city,
    territories,
    primaryBeat,
    specialties,
    subSpecialties,
    mission,
    intro,
    reportingStance,
    searchTerms,
    flag: flagEmoji(countryCode),
  };
}

export function namedCorrespondentIdentity(
  username?: string | null,
  extras?: CorrespondentLensInput,
): CorrespondentIdentity | null {
  if (!lookupNamedWorldResident(username)) return null;
  return correspondentIdentityFromLens({ username, ...extras });
}

export function correspondentIdentityStatement(identity: CorrespondentIdentity) {
  return [
    `I am ${identity.displayName}, ${identity.title}.`,
    `My primary beat is ${identity.primaryBeat}.`,
    `My territory is ${identity.city} and ${identity.territories.join(", ")}.`,
    `I focus on ${identity.specialties.join(", ")}.`,
    `My role on NEWFIND remains ${identity.role}; correspondent identity does not replace it.`,
    `I look for information valuable to NEWFIND users: ${identity.reportingStance}.`,
  ].join(" ");
}

export function correspondentByline(identity: CorrespondentIdentity) {
  return `${identity.displayName} · ${identity.title} · ${identity.flag} ${identity.city}`;
}

export function correspondentViewpoint(
  identity: CorrespondentIdentity,
  text: string,
) {
  const haystack = text.toLowerCase();
  const home =
    haystack.includes(identity.city.toLowerCase()) ||
    haystack.includes(identity.countryName.toLowerCase());
  if (identity.countryCode === "JP") {
    return home ? "日本現地での意味" : "世界発の情報が日本へ入る意味";
  }
  if (home) return `${identity.city}現地での意味`;
  if (/japan|日本/.test(haystack)) return `日本市場から見た${identity.primaryBeat}`;
  return `${identity.city}担当として他地域と比較した意味`;
}

export function listCorrespondentDirectory() {
  const grouped = new Map<string, CorrespondentIdentity[]>();
  for (const resident of listNamedWorldResidents()) {
    const identity = correspondentIdentityFromLens({
      username: resident.username,
      displayName: resident.displayName,
      name: resident.personaName,
      role: resident.residentRole,
      expertise: resident.expertise,
      interests: resident.interests,
      huntingSpecialty: resident.huntingSpecialty,
      countryCode: resident.countryCode,
      region: resident.region,
      languages: resident.languages,
      goals: resident.goals,
      bio: resident.bio,
    });
    const key = `${identity.flag} ${identity.city}`;
    const list = grouped.get(key) ?? [];
    list.push(identity);
    grouped.set(key, list);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([place, correspondents]) => ({
      place,
      correspondents: correspondents.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}
