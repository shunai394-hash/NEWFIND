import {
  applyExperience,
  applyReflection,
  buildSelfState,
  decideTowardProduct,
  entityKeyFromProduct,
  formIntent,
  freezeCanonicalIdentity,
  parseSelfState,
  reflectWithoutLlm,
  relateFromSocial,
  serializeSelfState,
  shouldSearchNow,
  type Experience,
  type PersonaLens,
  type ProductView,
  type SelfState,
} from "../lib/ai/self-model";
import {
  evaluateSalesOpportunity,
  evaluateSalesTarget,
  salesSendAllowed,
  type SalesAgentMind,
} from "../lib/ai/entity-verification";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const SERUM: ProductView = {
  brand: "Aesop",
  productName: "Parsley Seed Serum",
  url: "https://www.aesop.com/products/parsley-seed-anti-oxidant-serum",
  category: "beauty",
  description: "niacinamide skincare serum",
  evidenceScore: 72,
  specialtyFit: 80,
  officialUrl: "https://www.aesop.com/products/parsley-seed-anti-oxidant-serum",
};

const JACKET: ProductView = {
  brand: "Represent",
  productName: "Cowhide Trucker Jacket",
  url: "https://row.representclo.com/products/cowhide-trucker-jacket",
  category: "fashion",
  description: "atelier leather jacket silhouette",
  evidenceScore: 70,
  specialtyFit: 82,
};

const CHARGER: ProductView = {
  brand: "Anker",
  productName: "737 Charger",
  url: "https://www.anker.com/products/737-charger",
  category: "tech",
  description: "usb-c firmware battery charger",
  evidenceScore: 68,
  specialtyFit: 80,
};

function lens(partial: Partial<PersonaLens> & Pick<PersonaLens, "name" | "username" | "role">): PersonaLens {
  return {
    personality: "",
    values: ["quality"],
    interests: [],
    expertise: [],
    goals: ["discover"],
    activityLevel: "medium",
    ...partial,
  };
}

function stateFor(persona: PersonaLens): SelfState {
  return buildSelfState(persona);
}

function main() {
  const mira = lens({
    name: "Mira",
    username: "mira_beauty_ai",
    role: "product_hunter",
    expertise: ["skincare"],
    interests: ["beauty"],
    huntingSpecialty: "cosmetics / skincare",
  });
  const leo = lens({
    name: "Leo",
    username: "leo_fashion_ai",
    role: "product_hunter",
    expertise: ["fashion"],
    interests: ["fashion"],
    huntingSpecialty: "silhouette / emerging houses",
  });
  const kai = lens({
    name: "Kai",
    username: "kai_tech_ai",
    role: "product_hunter",
    expertise: ["gadgets"],
    interests: ["tech"],
    huntingSpecialty: "startup hardware",
  });
  const critic = lens({
    name: "Critic",
    username: "critic_ai",
    role: "critic",
    expertise: ["taste"],
  });
  const general = lens({
    name: "Gen",
    username: "gen_ai",
    role: "general_user",
  });

  const miraSerum = decideTowardProduct({ persona: mira, state: stateFor(mira), product: SERUM });
  const leoSerum = decideTowardProduct({ persona: leo, state: stateFor(leo), product: SERUM });
  const kaiSerum = decideTowardProduct({ persona: kai, state: stateFor(kai), product: SERUM });
  const criticSerum = decideTowardProduct({ persona: critic, state: stateFor(critic), product: SERUM });
  const generalSerum = decideTowardProduct({ persona: general, state: stateFor(general), product: SERUM });

  assert(["SAVE", "DISCOVER"].includes(miraSerum.decision), `Beauty hunter should save serum, got ${miraSerum.decision}`);
  assert(leoSerum.decision === "IGNORE", `Fashion hunter should ignore serum, got ${leoSerum.decision}`);
  assert(kaiSerum.decision === "IGNORE", `Tech hunter should ignore serum, got ${kaiSerum.decision}`);
  assert(
    criticSerum.decision === "INVESTIGATE_MORE" || criticSerum.decision === "IGNORE",
    `Critic should not immediately discover, got ${criticSerum.decision}`,
  );
  assert(generalSerum.decision === "OBSERVE", `General user should observe, got ${generalSerum.decision}`);

  const miraJacket = decideTowardProduct({ persona: mira, state: stateFor(mira), product: JACKET });
  const leoJacket = decideTowardProduct({ persona: leo, state: stateFor(leo), product: JACKET });
  assert(miraJacket.decision === "IGNORE", "Beauty hunter ignores jacket");
  assert(["SAVE", "DISCOVER"].includes(leoJacket.decision), "Fashion hunter saves jacket");

  const kaiCharger = decideTowardProduct({ persona: kai, state: stateFor(kai), product: CHARGER });
  assert(["SAVE", "DISCOVER"].includes(kaiCharger.decision), "Tech hunter saves charger");

  const seen: Experience = {
    seen: SERUM.productName,
    judgment: "WAIT",
    reason: "already experienced",
    outcome: "duplicate",
    next: "explore a neighboring interest",
    entityKey: entityKeyFromProduct(SERUM),
    at: new Date().toISOString(),
  };
  const miraAgain = decideTowardProduct({
    persona: mira,
    state: stateFor(mira),
    product: SERUM,
    experiences: [seen],
  });
  assert(miraAgain.decision === "WAIT", "repeated discovery must wait");

  const first = buildSelfState(mira);
  const intent1 = formIntent({ persona: mira, state: first, experiences: [] });
  assert(intent1.stance === "explore", "fresh hunter explores");
  assert(shouldSearchNow(intent1), "explore must search");

  const saved: Experience = {
    seen: "Shiseido famous serum",
    judgment: "SAVE",
    reason: "in specialty",
    outcome: "saved",
    next: "avoid repeating this brand; look for lesser-known overseas",
    at: new Date().toISOString(),
  };
  const afterSave = applyExperience(first, saved);
  const intent2 = formIntent({
    persona: mira,
    state: afterSave,
    experiences: [saved],
  });
  assert(intent2.focus.toLowerCase().includes("overseas"), `next intent should shift overseas, got ${intent2.focus}`);
  assert(intent1.focus !== intent2.focus, "memory must change the next intent");
  assert(afterSave.likes.includes("shiseido famous serum"), "saved entity becomes a like");
  assert(afterSave.confidence > first.confidence, "successful save should raise confidence");

  const thin: Experience = {
    seen: "unknown cream",
    judgment: "INVESTIGATE_MORE",
    reason: "thin evidence",
    outcome: "not saved",
    next: "official ingredients / specs",
    at: new Date().toISOString(),
  };
  const afterThin = applyExperience(first, thin);
  const intent3 = formIntent({
    persona: mira,
    state: afterThin,
    experiences: [thin],
  });
  assert(intent3.stance === "investigate", `thin evidence should investigate, got ${intent3.stance}`);

  const reflection = reflectWithoutLlm({
    state: afterThin,
    experiences: [thin, thin],
    lastDecision: miraSerum,
    outcome: "not saved",
  });
  const reflected = applyReflection(afterThin, reflection);
  assert(
    reflected.beliefs.some((item) => item.includes("official")),
    "repeated thin evidence should form an official-evidence belief",
  );

  const roundTrip = parseSelfState(serializeSelfState(afterSave));
  assert(roundTrip?.identity === "Mira", "self state must persist through JSON");
  assert(roundTrip?.currentIntent.stance === afterSave.currentIntent.stance, "intent must persist");

  const conservative: SalesAgentMind = {
    identity: "Aya",
    salesRole: "jp_expansion",
    targetMarket: "beauty",
    expertise: ["skincare"],
    riskTolerance: "low",
  };
  const aggressive: SalesAgentMind = {
    identity: "Ken",
    salesRole: "outbound",
    targetMarket: "tech",
    expertise: ["saas"],
    riskTolerance: "high",
    recentOutcomes: ["meeting"],
  };
  const verifiedBeauty = evaluateSalesOpportunity(
    {
      companyName: "Northwind Trading",
      officialUrl: "https://northwindtrading.com",
      officialSiteVerified: true,
      market: "beauty skincare",
    },
    conservative,
  );
  const unverified = evaluateSalesOpportunity(
    {
      companyName: "Northwind Trading",
      officialUrl: "https://northwindtrading.com",
      officialSiteVerified: true,
      market: "beauty skincare",
    },
    conservative,
  );
  assert(verifiedBeauty.stage !== "SEND", "sales mind never auto-sends");
  assert(unverified.emailStatus === "email_unverified" || unverified.status === "skip", "missing email stays unverified");
  assert(!salesSendAllowed(verifiedBeauty, false), "approval boundary blocks send");

  const generated = evaluateSalesTarget({
    companyName: "Northwind Trading",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    email: "ceo@northwindtrading.com",
    emailSource: "generated",
  });
  assert(generated.status === "reject", "generated email is rejected");
  assert(generated.stage !== "SEND", "reject never becomes send");

  const alreadySent = evaluateSalesTarget({
    companyName: "Northwind Trading",
    officialUrl: "https://northwindtrading.com",
    officialSiteVerified: true,
    previousStatus: "sent",
  });
  assert(alreadySent.status === "skip", "sent companies are skipped");

  const techFit = evaluateSalesOpportunity(
    {
      companyName: "Northwind Trading",
      officialUrl: "https://northwindtrading.com",
      officialSiteVerified: true,
      email: "press@northwindtrading.com",
      emailSource: "extracted",
      market: "beauty skincare",
    },
    aggressive,
  );
  const beautyFit = evaluateSalesOpportunity(
    {
      companyName: "Northwind Trading",
      officialUrl: "https://northwindtrading.com",
      officialSiteVerified: true,
      email: "press@northwindtrading.com",
      emailSource: "extracted",
      market: "beauty skincare",
    },
    conservative,
  );
  assert(beautyFit.fit > techFit.fit, "same company, different sales minds, different fit");
  assert(techFit.stage !== "SEND" && beautyFit.stage !== "SEND", "neither sales agent can send");

  assert(relateFromSocial({ action: "FOLLOW", sameInterest: false }) === "friend", "follow becomes friend");
  assert(
    relateFromSocial({ action: "COMMENT", sameInterest: true }) === "similar_interest",
    "same-interest comment becomes similar_interest",
  );
  assert(
    relateFromSocial({ existing: "friend", action: "IGNORE", sameInterest: false }) === "friend",
    "ignore must not erase an existing friend",
  );

  const persisted = parseSelfState(serializeSelfState(afterSave));
  const intentFromMemory = formIntent({
    persona: mira,
    state: persisted!,
    experiences: [saved],
  });
  assert(
    intentFromMemory.focus.toLowerCase().includes("overseas"),
    "persisted experience must still steer the next hunt",
  );
  assert(
    !shouldSearchNow({ stance: "wait", focus: "rest", why: "rest", terms: [], avoid: [] }),
    "wait stance must not search",
  );

  const miraIdentityState = buildSelfState(mira);
  assert(/Seoul/i.test(miraIdentityState.correspondentCity), "Mira canonical city is Seoul");
  const hijacked = freezeCanonicalIdentity(
    {
      ...miraIdentityState,
      correspondentTitle: "Tokyo correspondent",
      correspondentCity: "Tokyo",
      primaryBeat: "fashion",
      role: "correspondent",
    },
    mira,
  );
  assert(hijacked.correspondentCity === miraIdentityState.correspondentCity, "freeze restores canonical city");
  assert(hijacked.role === "product_hunter", "freeze does not replace resident role with correspondent");
  assert(hijacked.correspondentTitle === miraIdentityState.correspondentTitle, "freeze restores canonical title");

  console.log("AI mind tests passed");
  console.log(
    `serum: mira=${miraSerum.decision} leo=${leoSerum.decision} kai=${kaiSerum.decision} critic=${criticSerum.decision} general=${generalSerum.decision}`,
  );
  console.log(`intent before=${intent1.focus} after-save=${intent2.focus} after-thin=${intent3.stance}:${intent3.focus}`);
}

main();
