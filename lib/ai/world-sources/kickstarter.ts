import {
  searchWorld,
  type WorldSearchResult,
} from "@/lib/ai/world-search";

import type {
  WorldSourceCollector,
  WorldSourceCollectorContext,
  WorldSourceItem,
} from "./types";

const KICKSTARTER_QUERIES = [
  "new technology hardware",
  "robotics wearable",
  "new gadget electronics",
  "space technology",
];

function toItem(
  result: WorldSearchResult,
): WorldSourceItem | null {
  try {
    const url = new URL(result.url);

    if (
      url.hostname !== "kickstarter.com" &&
      url.hostname !== "www.kickstarter.com"
    ) {
      return null;
    }

    if (!url.pathname.startsWith("/projects/")) {
      return null;
    }

    return {
      ...result,
      sourceName: "kickstarter",
      sourceRef: `kickstarter:${url.pathname}`,
      signalType: "crowdfunding",
      domain: "kickstarter.com",
      sourceType: "other",
      sourceReliability: "official",
      metadata: {
        source: "kickstarter_world_search",
        projectPath: url.pathname,
      },
    };
  } catch {
    return null;
  }
}

export const kickstarterWorldSourceCollector: WorldSourceCollector = {
  source: "kickstarter",

  async collect(
    context: WorldSourceCollectorContext = {},
  ): Promise<WorldSourceItem[]> {
    const limit = Math.min(
      Math.max(context.limit ?? 10, 1),
      30,
    );

    const perQueryLimit = Math.max(
      3,
      Math.ceil(limit / KICKSTARTER_QUERIES.length),
    );

    const collected: WorldSourceItem[] = [];

    for (const query of KICKSTARTER_QUERIES) {
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
            "space technology",
          ],
          preferredCategories: [
            "tech",
            "hardware",
            "robotics",
            "science",
            "space",
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
            "kickstarter.com",
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
          "[kickstarter-world-source]",
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
