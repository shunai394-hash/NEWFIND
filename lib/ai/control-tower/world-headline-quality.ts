export type WorldHeadline = {
  actor: string;
  beat: string;
  kind: string;
  dispatch: string;
  title: string;
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
  if (/^(?:trend signal|unknown|untitled|no title|new discovery|discovery)\b/i.test(title)) {
    return false;
  }
  if (/^(?:expired|rejected|closed)$/i.test(headline.dispatch.trim())) {
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
