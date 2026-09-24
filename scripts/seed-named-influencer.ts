import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function hostKind(url: string | undefined): "local" | "cloud" | "missing" {
  if (!url) return "missing";
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return "local";
    return "cloud";
  } catch {
    return "missing";
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { FEATURED_INFLUENCER } = await import(
    "../lib/ai/featured-living-residents"
  );

  console.log("NAMED INFLUENCER SPEC (not auto-inserted by ai-act)");
  console.log(`persona=${FEATURED_INFLUENCER.personaName}`);
  console.log(`username=${FEATURED_INFLUENCER.username}`);
  console.log(`role=${FEATURED_INFLUENCER.residentRole}`);
  console.log(`region=${FEATURED_INFLUENCER.region}`);
  console.log(`avatar=${FEATURED_INFLUENCER.avatarUrl ? "set" : "missing"}`);
  console.log(`interests=${(FEATURED_INFLUENCER.interests ?? []).join(", ")}`);
  console.log(
    `categories=${(FEATURED_INFLUENCER.preferredCategories ?? []).join(", ")}`,
  );

  const kind = hostKind(process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(`supabaseHostKind=${kind}`);

  if (!apply) {
    console.log("dry spec only. Pass --apply on local Supabase to insert.");
    return;
  }

  if (kind !== "local" && process.env.AI_ALLOW_NAMED_SEED !== "1") {
    console.error("refusing INSERT: host is not local. No production seed.");
    process.exit(1);
  }

  const { ensureNamedInfluencer } = await import(
    "../lib/ai/ensure-featured-residents"
  );
  const result = await ensureNamedInfluencer();
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
