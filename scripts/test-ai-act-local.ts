async function main() {
  const port = process.env.TEST_PORT ?? "3011";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("CRON_SECRET is not set");
  }

  const url = `http://127.0.0.1:${port}/api/ai-act`;

  console.log(`GET ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const text = await response.text();

  console.log(`status ${response.status}`);

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    console.log(text);
    process.exit(response.ok ? 0 : 1);
  }

  console.log(`ok ${data.ok}`);
  console.log(`error ${data.error ?? "null"}`);
  console.log(`aiCount ${data.aiCount ?? 0}`);
  console.log(`worldNewsCount ${data.worldNewsCount ?? 0}`);

  if (data.factory) {
    console.log("\n=== FACTORY ===");
    console.dir(data.factory, { depth: null });
  }

  if (data.featuredResidents) {
    console.log("\n=== FEATURED RESIDENTS ===");
    console.dir(data.featuredResidents, { depth: null });
  }

  console.log("\n=== ALL AI RESIDENT ACTIONS ===");

  for (const result of data.results ?? []) {
    console.log("\n----------------------------------------");
    console.log(`persona: ${result.persona}`);
    console.log(`profileId: ${result.profileId}`);
    console.log(`residentRole: ${result.residentRole}`);
    console.log(`targetPostId: ${result.targetPostId ?? "none"}`);

    if (result.action) {
      console.log("action:");
      console.dir(result.action, { depth: null });
    }

    if (result.result) {
      console.log("execution:");
      console.dir(result.result, { depth: null });
    }

    if (result.productHunter) {
      console.log("productHunter:");
      console.dir(result.productHunter, { depth: null });
    }

    if (result.social) {
      console.log("social:");
      console.dir(result.social, { depth: null });
    }
  }

  console.log("\n=== END ===");

  if (!data.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

