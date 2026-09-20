import {
  commentHasInformationValue,
  isLowValueComment,
  nextExplorationHint,
  pickNextAxis,
  planTodayExploration,
  subjectLooksRepeated,
  type ExplorationAxis,
} from "../lib/ai/today-exploration";
import { formIntent, buildSelfState, type Experience } from "../lib/ai/self-model";
import { shouldExploreWorld, shouldExtraSearch } from "../lib/ai/correspondent";
import { buildPrecisionHuntQueries } from "../lib/ai/hunter-queries";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function experience(partial: Partial<Experience>): Experience {
  return {
    seen: "Aesop serum",
    judgment: "SAVE",
    reason: "saved",
    outcome: "posted",
    next: "Aesop competitors / other market reaction",
    entityKey: "aesop|parsley seed|https://www.aesop.com/products/serum",
    at: new Date().toISOString(),
    ...partial,
  };
}

function main() {
  const isla = {
    name: "Isla",
    username: "isla_ai",
    role: "critic",
    expertise: ["fashion", "culture"],
    interests: ["fashion"],
    countryCode: "GB",
    region: "UK",
    languages: ["en"],
    activityLevel: "medium" as const,
  };
  const mira = {
    name: "Mira",
    username: "mira_beauty_ai",
    role: "product_hunter",
    expertise: ["skincare", "beauty"],
    interests: ["beauty"],
    countryCode: "KR",
    huntingSpecialty: "k-beauty",
    languages: ["en"],
    activityLevel: "high" as const,
  };

  const day1 = planTodayExploration({ persona: isla, experiences: [], date: "2026-09-21" });
  const day2 = planTodayExploration({
    persona: isla,
    experiences: [experience({ outcome: "posted axis=new_products query=: london fashion official" })],
    recentQuests: [day1],
    date: "2026-09-22",
  });
  const day3 = planTodayExploration({
    persona: isla,
    experiences: [
      experience({
        outcome: "duplicate axis=emerging_brands",
        next: "leave emerging_brands; try a neighboring source class in London",
      }),
    ],
    recentQuests: [day2, day1],
    date: "2026-09-23",
  });

  assert(day1.city === "London", `Isla city should be London, got ${day1.city}`);
  assert(day1.beat === "fashion", `Isla beat should be fashion, got ${day1.beat}`);
  assert(day1.queries.length >= 1, "day 1 must have queries");
  assert(day1.axis !== day2.axis || day1.queries[0] !== day2.queries[0], "day 2 must change axis or query");
  assert(day3.axis !== day2.axis, `failed day 2 should change axis, got ${day2.axis} -> ${day3.axis}`);
  assert(!day1.queries.some((query) => /tokyo|seoul/i.test(query)), "London quest must not search Tokyo/Seoul");

  const miraQuest = planTodayExploration({ persona: mira, experiences: [], date: "2026-09-21" });
  assert(miraQuest.city === "Seoul", `Mira city ${miraQuest.city}`);
  assert(miraQuest.beat === "beauty", `Mira beat ${miraQuest.beat}`);
  assert(
    day1.queries.join(" ") !== miraQuest.queries.join(" "),
    "Isla and Mira must not share the same search",
  );

  const axes: ExplorationAxis[] = [];
  let last = day1;
  for (let i = 0; i < 7; i += 1) {
    last = planTodayExploration({
      persona: isla,
      recentQuests: [last, ...axes.map((axis) => ({ ...day1, axis }))],
      experiences: [experience({ outcome: `posted axis=${last.axis}` })],
      date: `2026-09-2${i}`,
    });
    axes.push(last.axis);
  }
  assert(new Set(axes).size >= 4, `7 days should rotate axes, got ${axes.join(",")}`);

  const skip = pickNextAxis({
    recentAxes: ["new_products"],
    lastOutcome: "0 new / duplicate",
  });
  assert(skip !== "new_products", "failed new_products must not repeat");

  const islaIntent = formIntent({
    persona: isla,
    state: buildSelfState(isla),
    experiences: [],
  });
  assert(islaIntent.stance === "explore", `Isla must explore daily, got ${islaIntent.stance}`);
  assert(/London|fashion/i.test(islaIntent.focus + islaIntent.why), "Isla intent stays in London fashion");
  assert(
    shouldExploreWorld({ intent: islaIntent, role: "critic", activityLevel: "medium" }),
    "critic must be allowed to explore the world",
  );
  assert(
    shouldExtraSearch({ intent: islaIntent, role: "critic", activityLevel: "medium" }),
    "critic must run extra world search",
  );

  const hunts = buildPrecisionHuntQueries({
    residentName: "Mira",
    interests: ["beauty"],
    preferredCategories: ["beauty"],
    goals: ["find products"],
    username: "mira_beauty_ai",
    country: "KR",
    exploration: miraQuest,
  });
  assert(hunts.some((item) => /Seoul|Korea|beauty/i.test(item.query)), "hunter queries follow the quest");
  assert(
    hunts[0].query !==
      buildPrecisionHuntQueries({
        residentName: "Mira",
        interests: ["beauty"],
        preferredCategories: ["beauty"],
        goals: ["find products"],
        username: "mira_beauty_ai",
        country: "KR",
        exploration: {
          ...miraQuest,
          axis: "emerging_brands",
          queries: ["Seoul independent beauty brand new"],
          terms: ["Seoul", "independent"],
        },
      })[0].query,
    "different quests must produce different hunter queries",
  );

  assert(isLowValueComment("すごい！"), "generic wow is empty");
  assert(isLowValueComment("love this"), "love this is empty");
  assert(!commentHasInformationValue("面白い"), "面白い has no information");
  assert(
    commentHasInformationValue("From London, the cut and price still don't match."),
    "local comparison is valuable",
  );
  assert(
    subjectLooksRepeated(
      { brand: "Aesop", productName: "Parsley Seed", productUrl: "https://www.aesop.com/products/serum" },
      ["aesop"],
    ),
    "yesterday brand must be dropped from today's subjects",
  );
  assert(
    nextExplorationHint(day1, { newCount: 0 }).includes("leave"),
    "empty day must leave the axis",
  );

  console.log("test-today-exploration ok");
  console.log(
    JSON.stringify(
      {
        isla: { axis: day1.axis, city: day1.city, q: day1.queries[0] },
        day2: { axis: day2.axis, q: day2.queries[0] },
        mira: { axis: miraQuest.axis, city: miraQuest.city, q: miraQuest.queries[0] },
        rotated: axes,
      },
      null,
      2,
    ),
  );
}

main();
