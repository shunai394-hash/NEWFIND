export type WorldHeadline = {
  actor: string;
  beat: string;
  kind: string;
  dispatch: string;
  title: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  confidence?: number | null;
  evidenceCount?: number | null;
};

function normalizeHeadline(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\p{S}]+/gu, "");
}

export function isPresentableWorldHeadline(headline: WorldHeadline): boolean {
  const title = headline.title.replace(/\s+/g, " ").trim();
  if (title.length < 12) return false;

  // Synthetic aggregates can be wrapped in otherwise plausible prose, so
  // reject them anywhere in the title rather than only at the first word.
  if (
    /\b(?:trend\s*signal|unknown|untitled|no\s+title|new\s+discovery|discovery\s+pending|mixed\s+unrelated\s+headlines)\b/i.test(title)
  ) {
    return false;
  }

  const status = headline.dispatch.trim().toLowerCase();
  if (
    /^(?:expired|rejected|closed|archived|failed|cancelled|canceled|draft)$/.test(status)
  ) {
    return false;
  }
  return true;
}

export function curateWorldHeadlines(
  headlines: WorldHeadline[],
  limit = 8,
): WorldHeadline[] {
  const seen = new Set<string>();
  const curated: WorldHeadline[] = [];

  for (const headline of headlines) {
    const title = headline.title.replace(/\s+/g, " ").trim();
    if (!isPresentableWorldHeadline({ ...headline, title })) continue;
    const key = normalizeHeadline(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    curated.push({ ...headline, title });
    if (curated.length >= limit) break;
  }

  return curated;
}
