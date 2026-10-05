import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

type ArxivEntry = {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  authors?: string[];
  categories?: string[];
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const start = block.indexOf(`<${tag}`);
  if (start < 0) return "";

  const contentStart = block.indexOf(">", start);
  if (contentStart < 0) return "";

  const contentEnd = block.indexOf(`</${tag}>`, contentStart);
  if (contentEnd < 0) return "";

  return cleanText(
    decodeXml(block.slice(contentStart + 1, contentEnd)),
  );
}

function extractAllTags(
  block: string,
  tag: string,
): string[] {
  const results: string[] = [];
  let cursor = 0;

  while (cursor < block.length) {
    const start = block.indexOf(`<${tag}`, cursor);
    if (start < 0) break;

    const contentStart = block.indexOf(">", start);
    if (contentStart < 0) break;

    const contentEnd = block.indexOf(
      `</${tag}>`,
      contentStart,
    );
    if (contentEnd < 0) break;

    const value = cleanText(
      decodeXml(
        block.slice(contentStart + 1, contentEnd),
      ),
    );

    if (value) results.push(value);

    cursor = contentEnd + tag.length + 3;
  }

  return results;
}

function extractCategoryTerms(block: string): string[] {
  const results: string[] = [];
  let cursor = 0;

  while (cursor < block.length) {
    const start = block.indexOf("<category", cursor);
    if (start < 0) break;

    const end = block.indexOf(">", start);
    if (end < 0) break;

    const fragment = block.slice(start, end + 1);
    const termStart = fragment.indexOf('term="');

    if (termStart >= 0) {
      const valueStart = termStart + 6;
      const valueEnd = fragment.indexOf('"', valueStart);

      if (valueEnd >= 0) {
        const value = cleanText(
          decodeXml(
            fragment.slice(valueStart, valueEnd),
          ),
        );

        if (value) results.push(value);
      }
    }

    cursor = end + 1;
  }

  return results;
}

function parseArxivFeed(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  let cursor = 0;

  while (cursor < xml.length) {
    const start = xml.indexOf("<entry>", cursor);
    if (start < 0) break;

    const end = xml.indexOf("</entry>", start);
    if (end < 0) break;

    const block = xml.slice(start, end + 8);

    entries.push({
      id: extractTag(block, "id"),
      title: extractTag(block, "title"),
      summary: extractTag(block, "summary"),
      published: extractTag(block, "published"),
      updated: extractTag(block, "updated"),
      authors: extractAllTags(block, "name"),
      categories: extractCategoryTerms(block),
    });

    cursor = end + 8;
  }

  return entries;
}

export const ARXIV_FUTURE_TECH_QUERY_GROUPS = [
  // AI, robotics, vision, machine learning, and human-computer interaction.
  "cat:cs.AI OR cat:cs.RO OR cat:cs.CV OR cat:cs.LG OR cat:cs.HC OR cat:cs.HRI",
  // Computer architecture, chips, systems, electronics, quantum, materials, and energy.
  "cat:cs.AR OR cat:cs.DC OR cat:cs.ET OR cat:cs.NI OR cat:eess.SY OR cat:eess.SP OR cat:quant-ph OR cat:cond-mat.mtrl-sci OR cat:physics.app-ph",
] as const;

/** Interleave research areas so a fast-moving AI category cannot crowd out hardware or materials. */
export function diversifyArxivEntries(
  groups: ArxivEntry[][],
  limit: number,
): ArxivEntry[] {
  const max = Math.max(0, Math.floor(limit));
  const seen = new Set<string>();
  const result: ArxivEntry[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < longest && result.length < max; index += 1) {
    for (const group of groups) {
      const entry = group[index];
      if (!entry || result.length >= max) continue;
      const key = String(entry.id ?? "").trim().replace(/\\/$/, "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
  }

  return result;
}

async function fetchArxivQuery(
  query: string,
  limit: number,
): Promise<ArxivEntry[]> {
  const url =
    "https://export.arxiv.org/api/query" +
    `?search_query=${encodeURIComponent(query)}` +
    "&start=0" +
    `&max_results=${Math.min(Math.max(limit, 1), 50)}` +
    "&sortBy=submittedDate" +
    "&sortOrder=descending";

  const response = await fetch(url, {
    headers: {
      Accept: "application/atom+xml",
      "User-Agent": "NEWFIND-World-Intelligence/1.0",
    },
    signal: AbortSignal.timeout(9_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`arXiv request failed: ${response.status}`);
  }

  return parseArxivFeed(await response.text());
}

async function fetchArxivFeed(limit: number): Promise<ArxivEntry[]> {
  const boundedLimit = Math.min(Math.max(limit, 1), 50);
  const results = await Promise.allSettled(
    ARXIV_FUTURE_TECH_QUERY_GROUPS.map((query) =>
      fetchArxivQuery(query, boundedLimit),
    ),
  );
  const fulfilled = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (fulfilled.length === 0) {
    const failure = results.find((result) => result.status === "rejected");
    throw failure?.status === "rejected"
      ? failure.reason
      : new Error("arXiv returned no research feeds");
  }

  return diversifyArxivEntries(fulfilled, boundedLimit);
}

export const arxivWorldSourceCollector: WorldSourceCollector = {
  source: "arxiv",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(
      Math.max(context.limit ?? 10, 1),
      50,
    );

    const entries = await fetchArxivFeed(limit);

    return entries
      .filter((entry) => entry.id && entry.title)
      .map((entry) => {
        const id = String(entry.id).replace(/^http:/i, "https:");
        const title = cleanText(entry.title);
        const summary = cleanText(entry.summary);

        return {
          title,
          url: id,
          snippet: summary.slice(0, 2000),
          sourceType: "editorial" as const,
          domain: "arxiv.org",
          language: "en",
          sourceCountry: "US",
          publishedAt:
            entry.published ||
            entry.updated ||
            null,
          sourceRole: "news" as const,
          origin: "web" as const,
          rawContent: summary || null,
          sourceReliability: "official",
          retrievedAt: new Date().toISOString(),

          sourceName: "arxiv" as const,
          sourceRef: id,
          signalType: "research" as const,

          metadata: {
            categories: entry.categories ?? [],
            authors: entry.authors ?? [],
            updatedAt: entry.updated ?? null,
            source: "arxiv_api",
          },
        };
      });
  },
};
