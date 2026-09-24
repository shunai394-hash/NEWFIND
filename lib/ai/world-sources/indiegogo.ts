import {
  searchWorld,
  type WorldSearchResult,
} from "@/lib/ai/world-search";

import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

const INDIEGOGO_QUERIES = [
  "new technology hardware",
  "robotics wearable",
  "new gadget electronics",
  "future technology",
];

function toItem(
  result: WorldSearchResult,
): WorldSourceItem | null {
  try {
    const url = new URL(result.url);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname !== "indiegogo.com" &&
      hostname !== "www.indiegogo.com"
    ) {
      return null;
    }

    if (!url.pathname.startsWith("/projects/")) {
      return null;
    }

    return {
      ...result,
      sourceName: "indiegogo",
      sourceRef: `indiegogo:${url.pathname}`,
      signalType: "crowdfunding",
      domain: "indiegogo.com",
      sourceType: "other",
      sourceReliability: "official",
      metadata: {
        source: "indiegogo_world_search",
        projectPath: url.pathname,
      },
    };
  } catch {
    return null;
  }
}

export const indiegogoWorldSourceCollector: WorldSourceCollector = {
  source: "indiegogo",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(
      Math.max(context.limit ?? 10, 1),
      30,
    );

    const perQueryLimit = Math.max(
      3,
      Math.ceil(limit / INDIEGOGO_QUERIES.length),
    );

    const collected: WorldSourceItem[] = [];

    for (const query of INDIEGOGO_QUERIES) {
      try {
        const results = await searchWorld({
          residentId: "world-intelligence",
          residentName: "NEWFIND World Intelligence",
          interests: [
            "AI",
            "technology",
            "hardware",
            "robotics",
            "wearables",
            "gadgets",
            "future technology",
          ],
          preferredCategories: [
            "tech",
            "hardware",
            "robotics",
            "science",
            "wearables",
          ],
          goals: [
            "discover emerging technology",
            "find new hardware",
            "find future products",
          ],
          query,
          country: context.country ?? "US",
          language: context.language ?? "en",
          expertise: [
            "technology",
            "hardware",
            "robotics",
            "future devices",
          ],
          values: [
            "novelty",
            "early discovery",
          ],
          discoveryKeywords: [
            "new",
            "launch",
            "prototype",
            "hardware",
            "robotics",
            "wearable",
            "gadget",
          ],
          huntingSpecialty:
            "early-stage technology and hardware",
          includeDomains: [
            "indiegogo.com",
          ],
        });

        for (const result of results.slice(
          0,
          perQueryLimit,
        )) {
          const item = toItem(result);

          if (item) {
            collected.push(item);
          }
        }
      } catch (error) {
        console.error(
          "[indiegogo-world-source]",
          query,
          error,
        );
      }
    }

    const seen = new Set<string>();

    return collected
      .filter((item) => {
        const key =
          item.sourceRef ||
          item.url.toLowerCase();

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, limit);
  },
};
