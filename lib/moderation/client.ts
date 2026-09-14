const LEGACY_BLOCKS_KEY = "newfind.blocked-users";
const OWNER_KEY = "newfind.blocked-users.owner";

let ownerId: string | null = null;

function ownerStorageKey(userId: string) {
  return `${LEGACY_BLOCKS_KEY}.${userId}`;
}

function readOwnerList(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ownerStorageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeOwnerList(userId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ownerStorageKey(userId),
    JSON.stringify([...new Set(ids)]),
  );
}

function readLegacyList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_BLOCKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function readLocal(): string[] {
  if (!ownerId) return [];
  return readOwnerList(ownerId);
}

function writeLocal(ids: string[]) {
  if (!ownerId) return;
  writeOwnerList(ownerId, ids);
}

export function setBlockOwner(userId: string | null) {
  ownerId = userId;
  if (typeof window === "undefined") return;

  if (!userId) {
    window.localStorage.removeItem(OWNER_KEY);
    window.localStorage.removeItem(LEGACY_BLOCKS_KEY);
    return;
  }

  window.localStorage.setItem(OWNER_KEY, userId);

  const legacy = readLegacyList();
  if (legacy.length > 0 && readOwnerList(userId).length === 0) {
    writeOwnerList(userId, legacy);
  }
  window.localStorage.removeItem(LEGACY_BLOCKS_KEY);
}

export function localBlockedIds() {
  return readLocal();
}

export function setLocalBlocks(ids: string[]) {
  writeLocal(ids);
}

export function clearLocalBlocks() {
  ownerId = null;
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OWNER_KEY);
  window.localStorage.removeItem(LEGACY_BLOCKS_KEY);
}

export function addLocalBlock(userId: string) {
  writeLocal([...readLocal(), userId]);
}

export function removeLocalBlock(userId: string) {
  writeLocal(readLocal().filter((id) => id !== userId));
}

export function isLocallyBlocked(userId: string) {
  return readLocal().includes(userId);
}

const AI_RESIDENT_USERNAMES = new Set([
  "yuna_ai",
  "isla_ai",
  "camille_ai",
  "noa_ai",
  "mira_beauty_ai",
  "leo_fashion_ai",
  "kai_tech_ai",
  "mei_food_ai",
  "lina_home_ai",
  "rio_fitness_ai",
  "hana_pet_ai",
  "noah_world_ai",
  "aya_wellness_ai",
  "jules_outdoor_ai",
  "sora_kids_ai",
  "kenji_japan_ai",
  "elena_stationery_ai",
  "theo_garden_ai",
  "nia_craft_ai",
  "maya_beauty_ai",
  "liam_tech_ai",
  "clara_home_ai",
  "riku_food_ai",
  "sofia_fashion_ai",
]);

export function isAiResidentUsername(username: string | null | undefined) {
  const key = (username ?? "").trim().toLowerCase();
  if (!key) return false;
  return AI_RESIDENT_USERNAMES.has(key);
}
