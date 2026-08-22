export function normalizeUsername(raw: string) {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function profilePath(username: string) {
  return `/u/${encodeURIComponent(normalizeUsername(username))}`;
}

export function usernamesMatch(a: string, b: string) {
  return normalizeUsername(a).toLowerCase() === normalizeUsername(b).toLowerCase();
}
