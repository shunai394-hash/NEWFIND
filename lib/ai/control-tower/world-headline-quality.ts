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

function isLikelyUntranslatedChineseTitle(title: string): boolean {
  // These simplified-only forms are strong signals of a Chinese source title,
  // while avoiding a blanket CJK filter that would reject Japanese headlines.
  return /[废盘预长驱农业统]/u.test(title) ||
    /(?:新闻和统计|可生物降解|市场展望至|需求驱动|增长至\d{4}年|预计增长)/u.test(title);
}

function isLikelyHeadlineBundle(title: string): boolean {
  // A single card must represent one discovery, not several source titles joined
  // together by a feed/import pipeline.
  const separators = title.match(/[,，、]/gu) ?? [];
  return separators.length >= 2;
}

function hasVerifiableSource(sourceUrl?: string | null): boolean {
  if (!sourceUrl?.trim()) return false;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    ) return false;
    return host.includes(".");
  } catch {
    return false;
  }
}

export function isPresentableWorldHeadline(headline: WorldHeadline): boolean {
  const title = headline.title.replace(/\s+/g, " ").trim();
  if (title.length < 12) return false;
  if (isLikelyUntranslatedChineseTitle(title)) return false;
  if (isLikelyHeadlineBundle(title)) return false;

  // Every public-facing research/news claim must lead to a verifiable source.
  // Do not make an unsourced title look like a reported discovery.
  if (!hasVerifiableSource(headline.sourceUrl)) return false;

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
