import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { getActiveAiPersonas } = await import("../lib/ai-post-engine");
  const { runResidentLifeCycle } = await import("../lib/ai/resident-life");
  const { getSharedWorldNews } = await import("../lib/ai/gdelt");
  const { getGoogleTrends } = await import("../lib/ai/google-trends");

  const personas = await getActiveAiPersonas();
  const noa = personas.find(
    (persona) =>
      persona.persona_name === "Noa" ||
      persona.username === "noa_ai",
  );

  if (!noa) {
    throw new Error("Noa was not found in the local staging database.");
  }

  console.log("========================================");
  console.log("NOA SINGLE RESIDENT DRY RUN");
  console.log(`persona=${noa.persona_name}`);
  console.log(`username=${noa.username}`);
  console.log(`role=${noa.resident_role}`);
  console.log(`profile_id=${noa.profile_id}`);
  console.log(`avatar=${noa.avatar_url ? "set" : "MISSING"}`);
  console.log("========================================");

  const worldNews = await getSharedWorldNews({ persist: false });
  const googleTrends = await getGoogleTrends();

  console.log(`worldNews=${worldNews.length}`);
  console.log(`googleTrends=${googleTrends.length}`);

  const result = await runResidentLifeCycle(
    noa,
    worldNews,
    googleTrends,
    { dryRun: true },
  );

  console.log("\n=== NOA RESULT ===");
  console.log(`role=${noa.resident_role}`);
  console.log(`work=${result.action.work.type}`);
  console.log(`workReason=${result.action.work.reason || ""}`);
  console.log(`caption=${result.action.work.caption || ""}`);
  console.log(`social=${result.action.social.type}`);
  console.log(
    `socialReason=${
      "reason" in result.action.social
        ? result.action.social.reason || ""
        : ""
    }`,
  );

  console.log("\n=== OBSERVATION ===");
  console.log(result.observation);

  console.log("\nNOA SINGLE RESIDENT DRY RUN COMPLETE");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
