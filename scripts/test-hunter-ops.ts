import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import path from "node:path";
import { SPECIALIST_PRODUCT_HUNTERS } from "../lib/ai/specialist-product-hunters";
import { getHunterStrategy } from "../lib/ai/hunter-strategies";
import { buildPrecisionHuntQueries, huntQueryIsFocused } from "../lib/ai/hunter-queries";
import { hunterLane, resultFitsHunterSpecialty } from "../lib/ai/specialty-fit";
import { isPostableDiscovery } from "../lib/ai/discovery-report";

loadEnvConfig(process.cwd());

const LIVE_HUNTERS = [
  { label: "Fashion", username: "leo_fashion_ai" },
  { label: "Sneakers", username: "nico_sneakers_ai" },
  { label: "Fragrance", username: "elise_scent_ai" },
  { label: "Beauty", username: "mira_beauty_ai" },
  { label: "Tech", username: "kai_tech_ai" },
  { label: "Gaming", username: "jun_gaming_ai" },
  { label: "Korea", username: "minji_korea_ai" },
  { label: "US indie", username: "harper_indie_ai" },
  { label: "EU design", username: "otto_eu_ai" },
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function checkExecutionPath() {
  const root = process.cwd();
  const aiAct = fs.readFileSync(path.join(root, "app/api/ai-act/route.ts"), "utf8");
  const vercel = JSON.parse(
    fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
  ) as { crons?: Array<{ path?: string; schedule?: string }> };
  const life = fs.readFileSync(path.join(root, "lib/ai/resident-life.ts"), "utf8");
  const hunter = fs.readFileSync(
    path.join(root, "lib/ai/resident-product-hunter.ts"),
    "utf8",
  );

  assert(
    vercel.crons?.some((item) => item.path === "/api/ai-act"),
    "vercel cron must target /api/ai-act",
  );
  assert(aiAct.includes("runResidentLifeCycle"), "ai-act must run resident life");
  assert(
    aiAct.includes("SPECIALIST_PRODUCT_HUNTERS"),
    "ai-act must schedule specialist hunters",
  );
  assert(
    life.includes("runResidentProductHunter"),
    "resident-life must call the product hunter",
  );
  assert(
    /playbook\.role === "product_hunter"/.test(life),
    "only product_hunter role should hunt",
  );
  assert(
    hunter.includes("loadResidentHumanSignals"),
    "hunter must load human signals before search",
  );
  assert(hunter.includes("planNextHunt"), "hunter must plan next hunt from signals");
  assert(
    hunter.includes("buildPrecisionHuntQueries"),
    "hunter must use precision queries",
  );
  console.log("EXECUTION PATH: cron /api/ai-act -> runResidentLifeCycle -> runResidentProductHunter");
  console.log(
    `cron schedule: ${vercel.crons?.find((item) => item.path === "/api/ai-act")?.schedule}`,
  );
}

async function main() {
  checkExecutionPath();

  const tavily = Boolean(process.env.TAVILY_API_KEY);
  const groq = Boolean(process.env.GROQ_API_KEY);
  console.log(`tavilyConfigured=${tavily} groqConfigured=${groq}`);

  const {
    isLiveWorldProduct,
    isNewsSignal,
    isProductSource,
    searchWorld,
  } = await import("../lib/ai/world-search");
  const { evaluateProductCandidates } = groq
    ? await import("../lib/ai/product-hunter")
    : { evaluateProductCandidates: null };

  const found: string[] = [];
  const empty: string[] = [];

  if (!tavily) {
    console.log("skip live world search: TAVILY_API_KEY missing");
    return;
  }

  for (const spec of LIVE_HUNTERS) {
    const hunter = SPECIALIST_PRODUCT_HUNTERS.find(
      (item) => item.username === spec.username,
    );
    assert(hunter, `missing hunter ${spec.username}`);
    const strategy = getHunterStrategy(spec.username);
    const lane = hunterLane(spec.username, hunter!.huntingSpecialty);
    const queries = buildPrecisionHuntQueries({
      residentName: hunter!.personaName,
      interests: hunter!.interests ?? [],
      preferredCategories: hunter!.preferredCategories ?? [],
      goals: hunter!.goals ?? [],
      expertise: hunter!.expertise,
      values: hunter!.values,
      country: hunter!.countryCode,
      language: hunter!.languages?.[0],
      favoriteBrands: hunter!.favoriteBrands,
      region: hunter!.region,
      discoveryKeywords: hunter!.discoveryKeywords,
      huntingSpecialty: hunter!.huntingSpecialty,
      username: spec.username,
      strategy,
    });

    console.log("\n========================================");
    console.log(`HUNTER ${spec.label} / ${hunter!.personaName} / lane=${lane}`);
    for (const query of queries) {
      console.log(
        `  [${query.label}] focused=${huntQueryIsFocused(query.query)} domains=${(query.includeDomains ?? []).join(",") || "open-web"} :: ${query.query}`,
      );
    }

    const merged = (
      await Promise.all(
        queries.map((query) =>
          searchWorld({
            ...query,
            residentId: "ops-dry-run",
            residentName: hunter!.personaName,
          }),
        ),
      )
    ).flat();
    const unique: typeof merged = [];
    const seen = new Set<string>();
    for (const result of merged) {
      const key = result.url.replace(/\/$/, "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(result);
    }

    const live = unique.filter(isLiveWorldProduct);
    const inLane = live.filter((result) =>
      resultFitsHunterSpecialty({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        username: spec.username,
        huntingSpecialty: hunter!.huntingSpecialty,
        strategy,
      }),
    );

    console.log(
      `  live=${live.length} inLane=${inLane.length} product=${unique.filter(isProductSource).length} news=${unique.filter(isNewsSignal).length}`,
    );

    if (inLane.length === 0) {
      empty.push(spec.label);
      console.log("  RESULT: 0 in-lane live PDPs");
      continue;
    }

    found.push(spec.label);
    for (const result of inLane.slice(0, 8)) {
      console.log(
        `  PDP [${result.origin}] ${result.title} | url=${result.url} | image=${result.imageUrl ? "yes" : "none"}`,
      );
    }

    if (!evaluateProductCandidates) {
      console.log("  skip candidate evaluation: GROQ_API_KEY missing");
      continue;
    }

    const candidates = await evaluateProductCandidates({
      residentId: "ops-dry-run",
      residentName: hunter!.personaName,
      personality: hunter!.personality,
      interests: hunter!.interests ?? [],
      preferredCategories: hunter!.preferredCategories ?? [],
      goals: hunter!.goals ?? [],
      expertise: hunter!.expertise,
      values: hunter!.values,
      region: hunter!.region,
      languages: hunter!.languages ?? [],
      culture: hunter!.culture,
      huntingSpecialty: hunter!.huntingSpecialty,
      hunterUsername: spec.username,
      results: unique,
    });

    if (candidates.length === 0) {
      console.log("  CANDIDATES 0 (in-lane PDPs existed but did not survive evidence)");
      continue;
    }

    for (const candidate of candidates) {
      const postable = isPostableDiscovery(candidate.report);
      console.log("  CANDIDATE", {
        lane,
        brand: candidate.brand,
        productName: candidate.productName,
        productUrl: candidate.productUrl,
        image: candidate.productImageUrl,
        price: candidate.price,
        currency: candidate.currency,
        evidence: candidate.report.evidence,
        evidenceScore: candidate.report.evidenceScore,
        residentFitScore: candidate.report.residentFitScore,
        postable,
      });
    }
  }

  console.log("\n========================================");
  console.log(`in-lane live hunters: ${found.join(", ") || "none"}`);
  console.log(`zero in-lane live hunters: ${empty.join(", ") || "none"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
