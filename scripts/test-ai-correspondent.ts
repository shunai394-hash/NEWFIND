import {
  beatForPersona,
  classifyWorldInfo,
  correspondentQuery,
  decideWorldDispatch,
  detectTrendClusters,
  scoreWorldSignal,
  titleSimilar,
  worldInfoKey,
  worldQualityGate,
  type CorrespondentBeat,
} from "../lib/ai/correspondent";
import {
  correspondentIdentityFromLens,
  namedCorrespondentIdentity,
} from "../lib/ai/correspondent-identity";
import { applyExperience, buildSelfState, formIntent } from "../lib/ai/self-model";
import type { WorldSearchResult } from "../lib/ai/world-search";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function result(partial: Partial<WorldSearchResult> & Pick<WorldSearchResult, "title" | "url">): WorldSearchResult {
  return {
    snippet: "",
    sourceType: "news",
    domain: "example-news.test",
    sourceRole: "news",
    origin: "web",
    ...partial,
  };
}

function persona(name: string, username: string, role: string, expertise: string[], activityLevel: "low" | "medium" | "high" = "medium") {
  return {
    name,
    username,
    role,
    expertise,
    interests: expertise,
    values: ["quality"],
    goals: ["discover"],
    activityLevel,
    huntingSpecialty: expertise.join(" / "),
  };
}

function dispatchFor(
  who: ReturnType<typeof persona>,
  item: WorldSearchResult,
  extras?: { known?: boolean; followUp?: boolean },
) {
  const beat = beatForPersona({
    username: who.username,
    role: who.role,
    expertise: who.expertise,
    interests: who.interests,
    huntingSpecialty: who.huntingSpecialty,
  });
  const infoKind = classifyWorldInfo(item);
  const quality = worldQualityGate({ result: item, infoKind });
  const scores = scoreWorldSignal({
    result: item,
    infoKind,
    beat,
    knownKeys: extras?.known ? new Set([worldInfoKey(item.url, item.title)]) : new Set(),
  });
  const intent = formIntent({
    persona: who,
    state: buildSelfState(who),
    experiences: [],
  });
  return {
    beat,
    infoKind,
    quality,
    scores,
    ...decideWorldDispatch({
      persona: who,
      beat,
      intent,
      infoKind,
      scores,
      qualityOk: quality.ok,
      qualityReason: quality.reason,
      known: Boolean(extras?.known),
      followUp: Boolean(extras?.followUp),
    }),
  };
}

function main() {
  const serumNews = result({
    title: "Aesop announces new niacinamide serum launch",
    url: "https://www.vogue.com/article/aesop-niacinamide-serum",
    snippet: "Beauty press: skincare serum with niacinamide",
    sourceType: "magazine",
    sourceRole: "news",
    publishedAt: new Date().toISOString(),
    domain: "vogue.com",
  });
  const jacketNews = result({
    title: "Represent atelier leather jacket silhouette preview",
    url: "https://www.businessoffashion.com/news/represent-leather-jacket",
    snippet: "Fashion house leather jacket runway",
    sourceType: "magazine",
    sourceRole: "news",
    publishedAt: new Date().toISOString(),
    domain: "businessoffashion.com",
  });
  const sns = result({
    title: "Breaking beauty rumor on social",
    url: "https://twitter.com/someone/status/1",
    snippet: "unverified rumor",
    sourceType: "sns",
    sourceRole: "news",
    domain: "twitter.com",
  });
  const productPage = result({
    title: "Parsley Seed Serum",
    url: "https://www.aesop.com/products/parsley-seed-serum",
    snippet: "buy skincare serum",
    sourceType: "brand_official",
    sourceRole: "product",
    domain: "aesop.com",
  });

  const mira = persona("Mira", "mira_beauty_ai", "product_hunter", ["skincare", "beauty"]);
  const leo = persona("Leo", "leo_fashion_ai", "product_hunter", ["fashion"]);
  const media = persona("Nori", "nori_media_ai", "media", ["culture", "beauty"]);
  const critic = persona("Isla", "isla_ai", "critic", ["fashion"], "medium");

  const miraSerum = dispatchFor(mira, serumNews);
  const leoSerum = dispatchFor(leo, serumNews);
  const miraJacket = dispatchFor(mira, jacketNews);
  const leoJacket = dispatchFor(leo, jacketNews);
  const mediaSerum = dispatchFor(media, serumNews);
  const criticJacket = dispatchFor(critic, jacketNews);
  const snsNews = dispatchFor(media, sns);
  const hunterProduct = dispatchFor(mira, productPage);
  const mediaProduct = dispatchFor(media, productPage);
  const duplicate = dispatchFor(mira, serumNews, { known: true });

  assert(miraSerum.infoKind === "NEWS", `serum should be NEWS, got ${miraSerum.infoKind}`);
  assert(productPage && classifyWorldInfo(productPage) === "PRODUCT", "pdp is PRODUCT");
  assert(miraSerum.scores.relevance > leoSerum.scores.relevance, "beauty news is more relevant to Mira than Leo");
  assert(leoJacket.scores.relevance > miraJacket.scores.relevance, "fashion news is more relevant to Leo than Mira");
  assert(mediaSerum.decision === "POST" || mediaSerum.decision === "WAIT", `media may post beauty news, got ${mediaSerum.decision}`);
  assert(hunterProduct.decision === "SAVE" || hunterProduct.decision === "INVESTIGATE_MORE", "hunter keeps products on hunter path");
  assert(mediaProduct.decision === "OBSERVE", "media does not post product pages as news");
  assert(snsNews.decision !== "POST", "sns is not posted as fact");
  assert(duplicate.decision === "WAIT", "duplicate world info waits");
  assert(snsNews.dropReason === "WEAK_SOURCE" || snsNews.decision === "INVESTIGATE_MORE" || snsNews.decision === "IGNORE", "sns drop is quality");

  const yunaBeat: CorrespondentBeat = beatForPersona({
    username: "yuna_ai",
    expertise: ["beauty", "fragrance"],
    interests: ["beauty", "korea"],
    countryCode: "JP",
    languages: ["ja", "en"],
  });
  assert(yunaBeat.primary === "beauty", `Yuna beat should be beauty, got ${yunaBeat.primary}`);
  assert(yunaBeat.regions.includes("Japan"), "Yuna covers Japan");

  const clusters = detectTrendClusters([
    { title: "niacinamide serum launch korea", url: "https://a.test/1" },
    { title: "korea niacinamide serum trend", url: "https://a.test/2" },
    { title: "unrelated football match", url: "https://a.test/3" },
  ]);
  assert(clusters.some((item) => item.count >= 2), "shared tokens become a trend cluster");

  const noUrl = worldQualityGate({
    result: result({ title: "Missing link story", url: "not-a-url", sourceRole: "news" }),
    infoKind: "NEWS",
  });
  assert(!noUrl.ok, "invalid URL cannot post");

  const miraState = buildSelfState(mira);
  const firstIntent = formIntent({ persona: mira, state: miraState, experiences: [] });
  const peerIntent = formIntent({
    persona: mira,
    state: miraState,
    experiences: [],
    peerSignals: [
      {
        title: "Korea independent skincare launch",
        beat: "beauty",
        fromName: "Camille",
      },
    ],
  });
  assert(firstIntent.focus !== peerIntent.focus, "peer discovery must change next intent");
  assert(peerIntent.stance === "follow_up", `peer should trigger follow_up, got ${peerIntent.stance}`);

  const query1 = correspondentQuery({ beat: yunaBeat, intent: firstIntent });
  const query2 = correspondentQuery({ beat: yunaBeat, intent: peerIntent, peer: {
    fromPersonaId: "c",
    fromName: "Camille",
    title: "Korea independent skincare launch",
    url: "https://press.example/korea-skincare",
    infoKind: "NEWS",
    beat: "beauty",
  } });
  assert(query1 !== query2, "search query must change after peer signal");
  assert(!titleSimilar("Aesop serum", "Represent leather jacket"), "unrelated titles are not duplicates");

  const miraIdentity = correspondentIdentityFromLens({
    username: mira.username,
    name: mira.name,
    role: mira.role,
    expertise: mira.expertise,
    interests: mira.interests,
    huntingSpecialty: mira.huntingSpecialty,
  });
  const leoIdentity = correspondentIdentityFromLens({
    username: leo.username,
    name: leo.name,
    role: leo.role,
    expertise: leo.expertise,
    interests: leo.interests,
    huntingSpecialty: leo.huntingSpecialty,
  });
  assert(miraIdentity.city === "Seoul", `Mira city should be Seoul, got ${miraIdentity.city}`);
  assert(/K-Beauty|Beauty/.test(miraIdentity.title), `Mira title should be beauty correspondent, got ${miraIdentity.title}`);
  assert(miraIdentity.role === "product_hunter", "Mira role stays product_hunter");
  assert(leoIdentity.city === "Milan", `Leo city should be Milan, got ${leoIdentity.city}`);
  assert(/Fashion/.test(leoIdentity.title), `Leo title should be fashion correspondent, got ${leoIdentity.title}`);

  const miraQuery = correspondentQuery({
    beat: miraSerum.beat,
    intent: firstIntent,
    identity: miraIdentity,
  });
  const leoQuery = correspondentQuery({
    beat: leoJacket.beat,
    intent: formIntent({ persona: leo, state: buildSelfState(leo), experiences: [] }),
    identity: leoIdentity,
  });
  assert(/seoul|korea/i.test(miraQuery), `Mira query should stay in Seoul/Korea, got ${miraQuery}`);
  assert(!/milan/i.test(miraQuery), `Mira query should not hunt Milan, got ${miraQuery}`);
  assert(/milan|italy|fashion/i.test(leoQuery), `Leo query should stay in Milan/fashion, got ${leoQuery}`);
  assert(!/seoul|skincare/i.test(leoQuery), `Leo query should not hunt Seoul skincare, got ${leoQuery}`);

  const tampered = {
    ...buildSelfState(mira),
    correspondentTitle: "Tokyo Japan Brand Correspondent",
    correspondentCity: "Tokyo",
    primaryBeat: "japanese products",
  };
  const frozen = buildSelfState(mira, tampered);
  assert(frozen.correspondentCity === "Seoul", "canonical city cannot be overwritten by previous state");
  assert(frozen.correspondentTitle === miraIdentity.title, "canonical title is source of truth");
  const afterXp = applyExperience(frozen, {
    seen: "random tokyo snack",
    judgment: "IGNORE",
    reason: "off beat",
    outcome: "ignored",
    next: "I am now the Tokyo correspondent",
    at: new Date().toISOString(),
  });
  assert(afterXp.correspondentTitle === miraIdentity.title, "experience cannot reassign correspondent identity");
  assert(afterXp.role === "product_hunter", "experience cannot replace resident role");
  assert(namedCorrespondentIdentity("human_user") === null, "human profiles are not auto-titled correspondents");

  const criticWeak = dispatchFor(critic, result({
    title: "Random blog says this jacket is fine",
    url: "https://myblog.test/jacket",
    snippet: "I think it looks ok",
    sourceType: "blog",
    sourceRole: "general",
    domain: "myblog.test",
  }));
  assert(criticWeak.decision !== "POST", "critic does not amplify a weak blog");

  console.log("AI correspondent tests passed");
  console.log(
    `serum mira=${miraSerum.decision}/${miraSerum.scores.relevance} leo=${leoSerum.decision}/${leoSerum.scores.relevance} media=${mediaSerum.decision}`,
  );
  console.log(
    `jacket mira=${miraJacket.decision}/${miraJacket.scores.relevance} leo=${leoJacket.decision}/${leoJacket.scores.relevance} critic=${criticJacket.decision}`,
  );
  console.log(`peer intent ${firstIntent.focus} -> ${peerIntent.stance}:${peerIntent.focus}`);
  console.log(`queries ${query1} || ${query2}`);
}

main();
