// NEWFIND world resident factory.
// AI personas are residents of this world, not content generators.
// Existing slot 1-10 residents are never rewritten here.
// New residents are composed from region, language, expertise, values,
// temperament, and role using slot_number as a stable seed.

import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateAiPersonaInput } from "@/lib/ai-personas";
import { createAiPersona } from "@/lib/ai-personas";
import {
  BEHAVIORS,
  EXTRA_INTERESTS,
  EXPERTISE_CATEGORIES,
  PRODUCT_TASTES,
  ROLE_ACTIVITY,
  TEMPERAMENTS,
  WORLD_EXPERTISE,
  WORLD_REGIONS,
  WORLD_ROLES,
  WORLD_VALUES,
  type BehaviorPattern,
  type NamePart,
  type ProductTaste,
  type RegionProfile,
  type Temperament,
  type WorldExpertise,
  type WorldLanguage,
  type WorldRole,
  type WorldValue,
} from "./world-resident-catalog";
import { buildResidentVoice } from "./world-resident-voice";

const DEFAULT_TARGET = 10;

function hashSlot(slot: number, salt: number): number {
  let x = Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return x >>> 0;
}

function pickCoprime(length: number, slot: number, stride: number): number {
  return ((slot - 1) * stride) % length;
}

function pickIndex(length: number, slot: number, salt: number): number {
  return hashSlot(slot, salt) % length;
}

function pickUnique<T>(
  items: readonly T[],
  slot: number,
  salt: number,
  excluded: T,
): T {
  if (items.length === 1) {
    return items[0];
  }

  let index = pickIndex(items.length, slot, salt);
  if (items[index] === excluded) {
    index = (index + 1) % items.length;
  }

  return items[index];
}

function displayNameFor(
  region: RegionProfile,
  given: NamePart,
  family: NamePart,
): string {
  if (region.nameOrder === "family-given") {
    return `${family.native} ${given.native}`;
  }

  return `${given.native} ${family.native}`;
}

function usernameFor(
  given: NamePart,
  family: NamePart,
  slotNumber: number,
): string {
  const base = `${given.roman}${family.roman}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 18);

  return `ai_${base || "resident"}_${slotNumber}`;
}

function primaryLanguageFor(
  region: RegionProfile,
  slotNumber: number,
): WorldLanguage {
  const roll = hashSlot(slotNumber, 17) % 10;

  switch (region.id) {
    case "japan":
      return "Japanese";
    case "south_korea":
      return "Korean";
    case "china":
    case "taiwan":
      return "Chinese";
    case "singapore":
      return roll < 7 ? "English" : "Chinese";
    case "india":
      return roll < 6 ? "English" : "Hindi";
    case "canada":
      return roll < 2 ? "French" : "English";
    case "mexico":
    case "spain":
      return "Spanish";
    case "brazil":
      return "Portuguese";
    case "france":
      return "French";
    case "germany":
      return "German";
    case "italy":
      return "Italian";
    case "netherlands":
      return "Dutch";
    case "sweden":
      return "Swedish";
    case "middle_east":
      return roll < 7 ? "Arabic" : "English";
    case "southeast_asia":
      return roll < 8 ? "English" : "Chinese";
    default:
      return "English";
  }
}

function languagesFor(
  region: RegionProfile,
  primary: WorldLanguage,
  slotNumber: number,
): WorldLanguage[] {
  const languages: WorldLanguage[] = [primary];

  for (const candidate of region.defaultLanguages) {
    if (!languages.includes(candidate)) {
      languages.push(candidate);
    }
  }

  if (hashSlot(slotNumber, 23) % 5 === 0 && !languages.includes("English")) {
    languages.push("English");
  }

  return languages.slice(0, 3);
}

function countryCodeFor(region: RegionProfile, slotNumber: number): string {
  const variants = region.countryCodeVariants;
  if (!variants || variants.length === 0) {
    return region.countryCode;
  }

  return variants[pickIndex(variants.length, slotNumber, 29)];
}

function activityFor(role: WorldRole, slotNumber: number): "low" | "medium" | "high" {
  const base = ROLE_ACTIVITY[role];
  const roll = hashSlot(slotNumber, 31) % 8;

  if (base === "high" && roll === 0) {
    return "medium";
  }

  if (base === "medium" && roll === 0) {
    return "low";
  }

  if (base === "medium" && roll === 1) {
    return "high";
  }

  return base;
}

function interestsFor(
  expertise: WorldExpertise[],
  taste: ProductTaste,
  slotNumber: number,
): string[] {
  const extras = [
    EXTRA_INTERESTS[pickIndex(EXTRA_INTERESTS.length, slotNumber, 41)],
    EXTRA_INTERESTS[pickIndex(EXTRA_INTERESTS.length, slotNumber, 43)],
    EXTRA_INTERESTS[pickIndex(EXTRA_INTERESTS.length, slotNumber, 47)],
  ];

  return Array.from(
    new Set([...expertise, taste, ...extras]),
  );
}

function categoriesFor(expertise: WorldExpertise[]): string[] {
  const categories = expertise.flatMap(
    (item) => EXPERTISE_CATEGORIES[item],
  );

  return Array.from(new Set(categories)).slice(0, 4);
}

function favoriteBrandsFor(
  region: RegionProfile,
  expertise: WorldExpertise[],
  values: WorldValue[],
  slotNumber: number,
): string[] {
  const localHints: Record<string, string[]> = {
    japan: ["local craft", "Tokyo independents"],
    south_korea: ["Seoul beauty labs", "Korean independents"],
    china: ["Shanghai design studios"],
    taiwan: ["Taipei cafes and makers"],
    singapore: ["independent Singapore makers"],
    india: ["Indian craft houses"],
    united_states: ["US independents"],
    canada: ["Canadian outdoor makers"],
    mexico: ["Mexican craft studios"],
    brazil: ["Brazilian beauty and design"],
    united_kingdom: ["British independents"],
    france: ["French maisons and ateliers"],
    germany: ["German industrial design"],
    italy: ["Italian workshops"],
    spain: ["Spanish design studios"],
    netherlands: ["Dutch functional design"],
    sweden: ["Nordic everyday makers"],
    australia: ["Australian independents"],
    new_zealand: ["Aotearoa makers"],
    middle_east: ["Gulf contemporary makers"],
    southeast_asia: ["Southeast Asian independents"],
  };

  const hints = localHints[region.id] ?? ["independent makers"];
  const hint = hints[pickIndex(hints.length, slotNumber, 53)];

  if (values.includes("local-culture") || values.includes("craftsmanship")) {
    return [hint];
  }

  if (expertise.includes("beauty") || expertise.includes("fashion")) {
    return [hint];
  }

  return [];
}

export type WorldResidentBlueprint = CreateAiPersonaInput & {
  slotNumber: number;
  primaryLanguage: WorldLanguage;
  temperament: Temperament;
  behavior: BehaviorPattern;
  productTaste: ProductTaste;
};

export function composeWorldResident(slotNumber: number): WorldResidentBlueprint {
  const region =
    WORLD_REGIONS[pickCoprime(WORLD_REGIONS.length, slotNumber, 1)];
  const role =
    WORLD_ROLES[pickCoprime(WORLD_ROLES.length, slotNumber, 4)];
  const expertisePrimary =
    WORLD_EXPERTISE[pickCoprime(WORLD_EXPERTISE.length, slotNumber, 5)];
  const valuePrimary =
    WORLD_VALUES[pickCoprime(WORLD_VALUES.length, slotNumber, 3)];
  const temperament =
    TEMPERAMENTS[pickCoprime(TEMPERAMENTS.length, slotNumber, 7)];
  const behavior =
    BEHAVIORS[pickCoprime(BEHAVIORS.length, slotNumber, 5)];
  const given =
    region.givenNames[pickIndex(region.givenNames.length, slotNumber, 57)];
  const family =
    region.familyNames[pickIndex(region.familyNames.length, slotNumber, 59)];

  const expertiseSecondary = pickUnique(
    WORLD_EXPERTISE,
    slotNumber,
    61,
    expertisePrimary,
  );
  const valueSecondary = pickUnique(
    WORLD_VALUES,
    slotNumber,
    67,
    valuePrimary,
  );
  const productTaste =
    PRODUCT_TASTES[pickIndex(PRODUCT_TASTES.length, slotNumber, 71)];

  const expertise: WorldExpertise[] = [expertisePrimary, expertiseSecondary];
  const values: WorldValue[] = [valuePrimary, valueSecondary];
  const primaryLanguage = primaryLanguageFor(region, slotNumber);
  const languages = languagesFor(region, primaryLanguage, slotNumber);
  const displayName = displayNameFor(region, given, family);
  const personaName = `${displayName} · ${slotNumber}`;
  const countryCode = countryCodeFor(region, slotNumber);

  const voice = buildResidentVoice(primaryLanguage, {
    displayName,
    region: region.region,
    role,
    expertise,
    values,
    temperament,
    behavior,
    culture: region.culture,
    productTaste,
  });

  return {
    slotNumber,
    username: usernameFor(given, family, slotNumber),
    displayName,
    personaName,
    personality: voice.personality,
    interests: interestsFor(expertise, productTaste, slotNumber),
    preferredCategories: categoriesFor(expertise),
    favoriteBrands: favoriteBrandsFor(region, expertise, values, slotNumber),
    postingStyle: voice.postingStyle,
    commentStyle: voice.commentStyle,
    activityLevel: activityFor(role, slotNumber),
    systemPrompt: voice.systemPrompt,
    residentRole: role,
    goals: voice.goals,
    countryCode,
    region: region.region,
    languages,
    expertise,
    values,
    culture: region.culture,
    primaryLanguage,
    temperament,
    behavior,
    productTaste,
  };
}

function getTargetPopulation() {
  const raw = Number(process.env.AI_RESIDENT_TARGET ?? DEFAULT_TARGET);

  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_TARGET;
  }

  return Math.floor(raw);
}

async function getActiveCount() {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("ai_personas")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) {
    throw new Error("AI resident count failed: " + error.message);
  }

  return count ?? 0;
}

async function claimResidentSlot(slotNumber: number): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_resident_slots")
    .insert({
      slot_number: slotNumber,
    })
    .select("slot_number")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return false;
    }

    throw new Error("AI resident slot claim failed: " + error.message);
  }

  return Boolean(data);
}

async function releaseResidentSlot(slotNumber: number): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("ai_resident_slots")
    .delete()
    .eq("slot_number", slotNumber)
    .is("persona_id", null);

  if (error) {
    console.error("AI resident slot release failed:", error);
  }
}

async function attachResidentToSlot(
  slotNumber: number,
  personaId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("ai_resident_slots")
    .update({
      persona_id: personaId,
    })
    .eq("slot_number", slotNumber)
    .is("persona_id", null);

  if (error) {
    throw new Error("AI resident slot attach failed: " + error.message);
  }
}

export type ResidentFactoryResult = {
  target: number;
  beforeCount: number;
  createdCount: number;
  afterCount: number;
  created: Array<{
    personaId: string;
    profileId: string;
    personaName: string;
    residentRole: string;
    slotNumber: number;
    region: string;
    languages: string[];
  }>;
};

export async function ensureAiResidentPopulation(): Promise<ResidentFactoryResult> {
  const target = getTargetPopulation();
  const beforeCount = await getActiveCount();

  if (beforeCount >= target) {
    return {
      target,
      beforeCount,
      createdCount: 0,
      afterCount: beforeCount,
      created: [],
    };
  }

  const needed = target - beforeCount;
  const created: ResidentFactoryResult["created"] = [];

  for (let i = 0; i < needed; i++) {
    const slotNumber = beforeCount + i + 1;
    const claimed = await claimResidentSlot(slotNumber);

    if (!claimed) {
      continue;
    }

    const resident = composeWorldResident(slotNumber);

    try {
      const result = await createAiPersona({
        username: resident.username,
        displayName: resident.displayName,
        personaName: resident.personaName,
        personality: resident.personality,
        interests: resident.interests,
        preferredCategories: resident.preferredCategories,
        favoriteBrands: resident.favoriteBrands,
        postingStyle: resident.postingStyle,
        commentStyle: resident.commentStyle,
        activityLevel: resident.activityLevel,
        systemPrompt: resident.systemPrompt,
        residentRole: resident.residentRole,
        goals: resident.goals,
        countryCode: resident.countryCode,
        region: resident.region,
        languages: resident.languages,
        expertise: resident.expertise,
        values: resident.values,
        culture: resident.culture,
      });

      await attachResidentToSlot(slotNumber, result.persona.id);

      created.push({
        personaId: result.persona.id,
        profileId: result.profileId,
        personaName: result.persona.persona_name,
        residentRole: resident.residentRole ?? "general_user",
        slotNumber,
        region: resident.region ?? "",
        languages: resident.languages ?? [],
      });
    } catch (error) {
      await releaseResidentSlot(slotNumber);
      throw error;
    }
  }

  return {
    target,
    beforeCount,
    createdCount: created.length,
    afterCount: beforeCount + created.length,
    created,
  };
}
