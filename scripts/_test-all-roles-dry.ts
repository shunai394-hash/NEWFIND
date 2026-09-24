import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function classifySupabaseHost(url: string | undefined): "local" | "cloud" | "missing" {
  if (!url) return "missing";
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return "local";
    return "cloud";
  } catch {
    return "missing";
  }
}

function looksCopied(caption: string, sources: string[]): boolean {
  const normalize = (value: string) =>
    value
      .replace(/\s+/g, "")
      .toLowerCase()
      .replace(/[、。,.!！?？「」『』"'“”]/g, "");
  const a = normalize(caption);
  if (a.length < 18) return false;
  for (const source of sources) {
    const b = normalize(source);
    if (b.length < 18) continue;
    if (a === b) return true;
    if (a.startsWith(b) || b.startsWith(a)) return true;
    if (a.includes(b) && b.length / a.length >= 0.55) return true;
    if (b.includes(a) && a.length / b.length >= 0.55) return true;
    const n = Math.min(a.length, b.length, 48);
    if (n >= 24 && a.slice(0, n) === b.slice(0, n)) return true;
  }
  return false;
}

async function main() {
  const groq = Boolean(process.env.GROQ_API_KEY);
  const tavily = Boolean(process.env.TAVILY_API_KEY);
  console.log(`groqConfigured=${groq} tavilyConfigured=${tavily}`);

  const supabaseKind = classifySupabaseHost(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  let localApi = false;
  try {
    const response = await fetch("http://127.0.0.1:54321/rest/v1/", {
      method: "HEAD",
      signal: AbortSignal.timeout(1500),
    });
    localApi = response.ok || response.status === 401 || response.status === 404;
  } catch {
    localApi = false;
  }
  console.log("\nSTAGING CHECK");
  console.log(`supabaseHostKind=${supabaseKind}`);
  console.log(`localSupabaseApi=${localApi ? "reachable" : "not running"}`);
  console.log(
    "vercel cron targets /api/ai-act on the deployed project; no staging env files in repo",
  );
  console.log(
    supabaseKind === "cloud"
      ? "DB looks production-like. /api/ai-act skipped. named influencer seed --apply skipped."
      : "DB is local or missing.",
  );

  const { classifyTavilyResult } = await import("../lib/ai/world-search");
  const { WORLD_ROLES, getRolePlaybook } = await import("../lib/ai/resident-roles");
  const { getActiveAiPersonas } = await import("../lib/ai-post-engine");
  const { runResidentLifeCycle } = await import("../lib/ai/resident-life");
  const { FEATURED_INFLUENCER, FEATURED_LIVING_RESIDENTS } = await import(
    "../lib/ai/featured-living-residents"
  );
  const { SPECIALIST_PRODUCT_HUNTERS } = await import(
    "../lib/ai/specialist-product-hunters"
  );
  const { composeWorldResident } = await import("../lib/ai/resident-factory");
  const { getSharedWorldNews } = await import("../lib/ai/gdelt");
  const { getGoogleTrends } = await import("../lib/ai/google-trends");

  const classifyCases = [
    ["news article", "https://www.reuters.com/world/fashion-week", "news", "news"],
    ["store homepage", "https://www.examplebrand.com/", "other", "general"],
    ["category page", "https://www.examplebrand.com/category/shoes", "retailer", "general"],
    ["search page", "https://www.examplebrand.com/search?q=jacket", "retailer", "general"],
    ["product page", "https://www.nike.com/products/air-max-90", "other", "product"],
    ["collection listing", "https://www.examplebrand.com/collections/summer", "other", "general"],
    ["sns profile", "https://www.instagram.com/examplebrand/", "sns", "general"],
  ] as const;

  let passed = 0;
  for (const [name, url, sourceType, expected] of classifyCases) {
    const actual = classifyTavilyResult(name, url, "Buy now. Price 10.", sourceType);
    const ok = actual === expected;
    if (ok) passed += 1;
    console.log(`CLASSIFY ${ok ? "PASS" : "FAIL"}: ${name} -> ${actual}`);
  }
  console.log(`URL classification ${passed}/${classifyCases.length}`);
  if (passed !== classifyCases.length) {
    throw new Error("URL classification failed");
  }

  let personas: Awaited<ReturnType<typeof getActiveAiPersonas>> = [];
  try {
    personas = await getActiveAiPersonas();
  } catch (error) {
    console.log("DB persona load failed (read-only). Using in-memory specs.");
    console.error(error instanceof Error ? error.message : error);
  }

  const counts = new Map<string, number>();
  for (const persona of personas) {
    const role = persona.resident_role || "general_user";
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  console.log("\nROLE COUNTS FROM DB:");
  if (personas.length === 0) {
    console.log("(none loaded)");
  } else {
    for (const [role, count] of [...counts.entries()].sort()) {
      console.log(`- ${role}: ${count}`);
    }
  }
  console.log(`- influencer: ${counts.get("influencer") ?? 0} (named spec Noa is seed-only, not auto-inserted)`);

  const picked = new Map<string, (typeof personas)[number]>();
  for (const persona of personas) {
    const role = persona.resident_role || "general_user";
    if (!picked.has(role)) picked.set(role, persona);
  }

  const fromSpec = (
    spec: (typeof FEATURED_LIVING_RESIDENTS)[number],
    role = spec.residentRole || "general_user",
  ) => ({
    id: crypto.randomUUID(),
    profile_id: crypto.randomUUID(),
    persona_name: spec.personaName,
    personality: spec.personality,
    interests: spec.interests ?? [],
    preferred_categories: spec.preferredCategories ?? [],
    favorite_brands: spec.favoriteBrands ?? [],
    posting_style: spec.postingStyle,
    comment_style: spec.commentStyle,
    activity_level: spec.activityLevel,
    system_prompt: spec.systemPrompt,
    resident_role: spec.residentRole,
    goals: spec.goals,
    region: spec.region,
    country_code: spec.countryCode,
    languages: spec.languages,
    expertise: spec.expertise,
    values: spec.values,
    culture: spec.culture,
  });

  if (!picked.has("product_hunter")) {
    const hunter = SPECIALIST_PRODUCT_HUNTERS[0];
    if (hunter) picked.set("product_hunter", fromSpec(hunter, "product_hunter"));
  }
  if (!picked.has("influencer")) {
    picked.set("influencer", fromSpec(FEATURED_INFLUENCER, "influencer"));
  }
  for (const spec of FEATURED_LIVING_RESIDENTS) {
    const role = spec.residentRole || "general_user";
    if (!picked.has(role)) picked.set(role, fromSpec(spec, role));
  }
  for (let slot = 1; slot <= 40 && picked.size < WORLD_ROLES.length; slot += 1) {
    const blueprint = composeWorldResident(slot);
    const role = blueprint.residentRole || "general_user";
    if (picked.has(role)) continue;
    picked.set(role, fromSpec({
      ...blueprint,
      username: blueprint.username || `slot_${slot}`,
      displayName: blueprint.displayName || blueprint.personaName,
    }, role));
  }

  let worldNews: Awaited<ReturnType<typeof getSharedWorldNews>> = [];
  try {
    worldNews = await getSharedWorldNews({ persist: false });
  } catch (error) {
    console.error("world news fetch failed (read-only)", error);
    worldNews = [];
  }
  let googleTrends: Awaited<ReturnType<typeof getGoogleTrends>> = [];
  try {
    googleTrends = await getGoogleTrends(8);
  } catch (error) {
    console.error("google trends fetch failed", error);
    googleTrends = [];
  }
  console.log(
    `\nSIGNALS news=${worldNews.length} trends=${googleTrends.length} persistNewsCache=false`,
  );
  for (const article of worldNews.slice(0, 3)) {
    console.log(`NEWS ${article.title.slice(0, 80)}`);
  }
  for (const trend of googleTrends.slice(0, 3)) {
    console.log(`TREND ${trend.title}`);
  }

  if (!groq) {
    console.log("skip role lifecycle dry-run: GROQ_API_KEY missing");
    return;
  }

  const summaries: Array<{
    role: string;
    persona: string;
    work: string;
    social: string;
    caption?: string;
    query: string | null;
    subjects: string[];
    memory: string;
    copied: boolean;
    socialTarget: string | null;
    hunterOrigins: string[];
  }> = [];

  for (const role of WORLD_ROLES) {
    const persona = picked.get(role);
    if (!persona) {
      console.log(`\nMISSING ROLE SAMPLE: ${role}`);
      continue;
    }
    const playbook = getRolePlaybook(role);
    console.log("\n========================================");
    console.log(`ROLE ${role}`);
    console.log(`RESIDENT ${persona.persona_name}`);
    console.log(`WORK ${playbook.work}`);
    console.log(`SOURCES ${playbook.sources.join(", ")}`);

    if (role === "product_hunter" && !tavily) {
      console.log("skip product hunter search: TAVILY_API_KEY missing");
    }

    const result = await runResidentLifeCycle(
      persona,
      worldNews,
      googleTrends,
      { dryRun: true },
    );
    const caption = result.action.work.caption || "";
    const feedCaptions = result.observation?.feedCaptions ?? [];
    const copied = looksCopied(caption, feedCaptions);
    const socialTarget =
      "postId" in result.action.social
        ? result.action.social.postId
        : "profileId" in result.action.social
          ? result.action.social.profileId
          : null;
    const hunterOrigins = result.observation?.hunterOrigins ?? [];
    summaries.push({
      role,
      persona: persona.persona_name,
      work: result.action.work.type,
      social: result.action.social.type,
      caption,
      query: result.observation?.query ?? null,
      subjects: result.observation?.subjectKinds ?? [],
      memory: result.memoryCandidate ?? "",
      copied,
      socialTarget,
      hunterOrigins,
    });

    console.log(`OBSERVATION ${result.observation?.reason ?? ""}`);
    console.log(
      `OBSERVATION news=${result.observation?.newsCount} trends=${result.observation?.trendCount} feed=${result.observation?.feedCount} follows=${result.observation?.followingCount}`,
    );
    console.log(`OBSERVATION query=${result.observation?.query ?? "none"}`);
    console.log(
      `OBSERVATION subjects=${(result.observation?.subjects ?? [])
        .map((item) => `${item.kind}:${item.label.slice(0, 40)}`)
        .join(" | ") || "none"}`,
    );
    if (result.observation?.newsHeadlines?.length) {
      console.log(
        `OBSERVATION headlines=${result.observation.newsHeadlines.slice(0, 3).join(" / ")}`,
      );
    }
    if (result.observation?.trendTitles?.length) {
      console.log(
        `OBSERVATION trends=${result.observation.trendTitles.slice(0, 3).join(" / ")}`,
      );
    }
    console.log(
      `REASON ${playbook.workBias.slice(0, 120)}`,
    );
    console.log(
      `WORK ${result.action.work.type} posted=${result.action.work.posted} reason=${result.action.work.skipReason ?? ""}`,
    );
    console.log(`SUBJECT caption=${caption.slice(0, 160)}`);
    console.log(
      `SOCIAL ${result.action.social.type} target=${socialTarget ?? "none"}`,
    );
    console.log(`MEMORY ${result.memoryCandidate}`);
    console.log(`COPY ${copied ? "FAIL copied feed caption" : "PASS"}`);
    if (role === "product_hunter") {
      const liveOrigins = hunterOrigins.filter((item) => item !== "catalog");
      const catalogPosted = (result.observation?.subjectKinds ?? []).includes(
        "hunter",
      )
        ? hunterOrigins.includes("catalog") && liveOrigins.length === 0
        : false;
      console.log(
        `ORIGIN hunter=${hunterOrigins.join(",") || "none"} catalogAsDiscovery=${catalogPosted ? "FAIL" : "PASS"}`,
      );
    }
  }

  console.log("\n========================================");
  console.log("SAME-ACTION / COPY / SOCIAL CHECK");
  const captions = summaries.map((row) => row.caption || "").filter(Boolean);
  const uniqueCaptions = new Set(captions);
  const socials = summaries.map((row) => `${row.role}:${row.social}`);
  const queries = summaries.map((row) => row.query).filter(Boolean);
  const copyFails = summaries.filter((row) => row.copied);
  const socialTargets = summaries
    .map((row) => row.socialTarget)
    .filter((item): item is string => Boolean(item));
  const uniqueTargets = new Set(socialTargets);
  console.log(`captions ${captions.length} unique ${uniqueCaptions.size}`);
  console.log(`socials ${socials.join(" | ")}`);
  console.log(`queries ${queries.length ? queries.join(" | ") : "none (only hunters search)"}`);
  console.log(
    copyFails.length
      ? `COPY FAIL: ${copyFails.map((row) => row.role).join(", ")}`
      : "COPY PASS: generated captions are not feed copies",
  );
  console.log(
    uniqueCaptions.size === captions.length || captions.length <= 1
      ? "OK: captions are not identical across roles"
      : "WARN: some captions collided",
  );
  console.log(
    socialTargets.length > 1 && uniqueTargets.size === 1
      ? "WARN: every social action hit the same post"
      : "OK: social targets are not all the same post",
  );
  const hunterQuery = summaries.find((row) => row.role === "product_hunter")?.query || "";
  if (/cafes?|travel/i.test(hunterQuery)) {
    throw new Error(`hunter query still noisy: ${hunterQuery}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
