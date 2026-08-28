const BLOCKS_KEY = "newfind.blocked-users";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BLOCKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLOCKS_KEY, JSON.stringify([...new Set(ids)]));
}

export function localBlockedIds() {
  return readLocal();
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
