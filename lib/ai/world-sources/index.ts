import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";
import { productHuntWorldSourceCollector } from "./product-hunt";
import { huggingFaceWorldSourceCollector } from "./hugging-face";
import { githubWorldSourceCollector } from "./github";
import { arxivWorldSourceCollector } from "./arxiv";
import { nasaWorldSourceCollector } from "./nasa";
import { kickstarterWorldSourceCollector } from "./kickstarter";
import { indiegogoWorldSourceCollector } from "./indiegogo";
import { googleTrendsWorldSourceCollector } from "./google-trends";

export const worldSourceCollectors: WorldSourceCollector[] = [
  productHuntWorldSourceCollector,
  huggingFaceWorldSourceCollector,
  githubWorldSourceCollector,
  arxivWorldSourceCollector,
  nasaWorldSourceCollector,
  kickstarterWorldSourceCollector,
  indiegogoWorldSourceCollector,
  googleTrendsWorldSourceCollector,
];

export async function collectWorldIntelligence(
  context: WorldSourceCollectorContext = {},
): Promise<WorldSourceItem[]> {
  const results = await Promise.allSettled(
    worldSourceCollectors.map((collector) =>
      collector.collect(context),
    ),
  );

  const items: WorldSourceItem[] = [];

  for (const [index, result] of results.entries()) {
    const collector = worldSourceCollectors[index];

    if (result.status === "fulfilled") {
      items.push(...result.value);
      continue;
    }

    console.error(
      `[World Intelligence] ${collector.source} collector failed:`,
      result.reason,
    );
  }

  const normalized = items.map((item) => ({
    ...item,
    title: item.title.trim(),
    url: item.url.trim(),
    snippet: item.snippet.trim().slice(0, 2000),
    domain: item.domain.trim().toLowerCase(),
    sourceRef: item.sourceRef.trim(),
  }));

  const seen = new Set<string>();

  return normalized.filter((item) => {
    const key =
      `${item.sourceName}:${item.sourceRef}`.toLowerCase();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
