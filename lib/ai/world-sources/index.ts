import {
  dedupeWorldSourceItems,
  type WorldSourceCollector,
  type WorldSourceCollectorContext,
  type WorldSourceItem,
} from "./types";
import { productHuntWorldSourceCollector } from "./product-hunt";
import { huggingFaceWorldSourceCollector } from "./hugging-face";
import { githubWorldSourceCollector } from "./github";
import { arxivWorldSourceCollector } from "./arxiv";
import { nasaWorldSourceCollector } from "./nasa";
import { kickstarterWorldSourceCollector } from "./kickstarter";
import { indiegogoWorldSourceCollector } from "./indiegogo";
import { googleTrendsWorldSourceCollector } from "./google-trends";
import { futureTechNewsWorldSourceCollector } from "./future-tech-news";

export const worldSourceCollectors: WorldSourceCollector[] = [
  productHuntWorldSourceCollector,
  huggingFaceWorldSourceCollector,
  githubWorldSourceCollector,
  arxivWorldSourceCollector,
  nasaWorldSourceCollector,
  kickstarterWorldSourceCollector,
  indiegogoWorldSourceCollector,
  googleTrendsWorldSourceCollector,
  futureTechNewsWorldSourceCollector,
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

  return dedupeWorldSourceItems(items);
}
