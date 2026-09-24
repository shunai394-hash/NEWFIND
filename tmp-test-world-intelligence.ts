import { collectWorldIntelligence } from "./lib/ai/world-sources";

async function main() {
  const items = await collectWorldIntelligence({ limit: 5 });

  const bySource = items.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.sourceName] = (acc[item.sourceName] ?? 0) + 1;
      return acc;
    },
    {},
  );

  console.log(JSON.stringify({
    total: items.length,
    bySource,
    samples: items.map((item) => ({
      source: item.sourceName,
      signal: item.signalType,
      title: item.title,
      url: item.url,
      country: item.sourceCountry,
      ref: item.sourceRef,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
