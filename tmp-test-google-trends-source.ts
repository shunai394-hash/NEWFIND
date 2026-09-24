import { googleTrendsWorldSourceCollector } from "./lib/ai/world-sources/google-trends";

async function main() {
  const items = await googleTrendsWorldSourceCollector.collect({ limit: 20 });

  console.log(JSON.stringify({
    count: items.length,
    byCountry: items.reduce<Record<string, number>>((acc, item) => {
      const country = item.sourceCountry ?? "unknown";
      acc[country] = (acc[country] ?? 0) + 1;
      return acc;
    }, {}),
    samples: items.map((item) => ({
      country: item.sourceCountry,
      title: item.title,
      url: item.url,
      sourceRef: item.sourceRef,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
