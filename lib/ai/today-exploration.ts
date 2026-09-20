/**
 * Daily world-exploration quest for an existing resident.
 * Deterministic: previous results choose the next axis.
 * Not a weekday bot. Does not add residents or roles.
 */

import {
  correspondentIdentityFromLens,
  type CorrespondentIdentity,
} from "@/lib/ai/correspondent-identity";
import type { Experience, PersonaLens } from "@/lib/ai/self-model";

export const EXPLORATION_AXES = [
  "new_products",
  "emerging_brands",
  "local_retail",
  "local_media",
  "trend_signals",
  "independent_creators",
  "cross_region",
] as const;

export type ExplorationAxis = (typeof EXPLORATION_AXES)[number];

export const SOURCE_CLASSES = [
  "official",
  "local_retail",
  "local_media",
  "specialist_media",
  "community",
  "trend",
  "startup",
  "indie_brand",
  "marketplace",
] as const;

export type SourceClass = (typeof SOURCE_CLASSES)[number];

export type SeenExploration = {
  brands: string[];
  products: string[];
  sources: string[];
  queries: string[];
  axes: ExplorationAxis[];
};

export type ExplorationQuest = {
  date: string;
  resident: string;
  role: string;
  axis: ExplorationAxis;
  goal: string;
  region: string;
  city: string;
  beat: string;
  sources: SourceClass[];
  reason: string;
  queries: string[];
  terms: string[];
  followUps: string[];
  avoidQueries: string[];
  avoidEntities: string[];
  includeDomains: string[];
  excludeDomains: string[];
};

const AXIS_SOURCES: Record<ExplorationAxis, SourceClass[]> = {
  new_products: ["official", "indie_brand", "local_retail"],
  emerging_brands: ["indie_brand", "startup", "specialist_media"],
  local_retail: ["local_retail", "official", "marketplace"],
  local_media: ["local_media", "specialist_media", "community"],
  trend_signals: ["trend", "specialist_media", "community"],
  independent_creators: ["indie_brand", "community", "startup"],
  cross_region: ["specialist_media", "official", "local_media"],
};

const LOCAL_MEDIA: Record<string, string[]> = {
  London: ["vogue.co.uk", "dazeddigital.com", "timeout.com"],
  Seoul: ["vogue.co.kr", "oliveyoung.com", "hypebeast.com"],
  Tokyo: ["fashionsnap.com", "cosme.net", "wwd.com"],
  Paris: ["vogue.fr", "numéro.com", "timeout.fr"],
  "New York": ["vogue.com", "theverge.com", "techcrunch.com"],
  Milan: ["vogue.it", "wwd.com"],
  Bangkok: ["timeout.com", "bk-magazine.com"],
};

const LOCAL_RETAIL: Record<string, string[]> = {
  London: ["matchesfashion.com", "endclothing.com", "selfridges.com"],
  Seoul: ["oliveyoung.com", "29cm.co.kr", "ssfshop.com"],
  Tokyo: ["muji.com", "rakuten.co.jp", "i-voce.jp"],
  Paris: ["merci-merci.com", "galerieslafayette.com"],
  "New York": ["ssense.com", "bhphotovideo.com", "nordstrom.com"],
  Milan: ["luisaviaroma.com", "farfetch.com"],
  Bangkok: ["central.co.th", "shopee.co.th"],
};

const SPAM_DOMAINS = [
  "pinterest.com",
  "aliexpress.com",
  "wish.com",
  "dhgate.com",
  "temu.com",
  "shein.com",
];

const OTHER_CITIES = [
  "London",
  "Seoul",
  "Tokyo",
  "Paris",
  "New York",
  "Milan",
  "Bangkok",
];

const AXIS_GOALS: Record<ExplorationAxis, (city: string, beat: string) => string> = {
  new_products: (city, beat) =>
    `Find newly launched ${beat} products that appeared around ${city}`,
  emerging_brands: (city, beat) =>
    `Find independent ${beat} brands recently visible in ${city}`,
  local_retail: (city, beat) =>
    `Check ${city} retailers for new ${beat} arrivals, not the same flagship pages`,
  local_media: (city, beat) =>
    `Read ${city} specialist media for ${beat} news that is not yesterday's story`,
  trend_signals: (city, beat) =>
    `Catch rising ${beat} signals that matter in ${city} this week`,
  independent_creators: (city, beat) =>
    `Look for ${city} makers and small labels in ${beat}, not global mall brands`,
  cross_region: (city, beat) =>
    `Compare how ${beat} from ${city} is landing in a neighboring market`,
};

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    const folded = key.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(key);
  }
  return out;
}

function compact(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function isExplorationAxis(value: string | null | undefined): value is ExplorationAxis {
  return Boolean(value && (EXPLORATION_AXES as readonly string[]).includes(value));
}

export function extractSeenEntities(experiences: Experience[]): SeenExploration {
  const brands: string[] = [];
  const products: string[] = [];
  const sources: string[] = [];
  const queries: string[] = [];
  const axes: ExplorationAxis[] = [];

  for (const item of experiences.slice(0, 12)) {
    const blob = `${item.seen} ${item.reason} ${item.outcome} ${item.next} ${item.entityKey ?? ""}`;
    const axisMatch = blob.match(
      /axis=(new_products|emerging_brands|local_retail|local_media|trend_signals|independent_creators|cross_region)/,
    );
    if (axisMatch && isExplorationAxis(axisMatch[1])) axes.push(axisMatch[1]);

    const brand = blob.match(/brand[:\s]+([^,|/]+)/i)?.[1];
    if (brand) brands.push(brand.trim());
    if (item.entityKey?.includes("|")) {
      const [left, mid] = item.entityKey.split("|");
      if (left) brands.push(left);
      if (mid) products.push(mid);
    } else if (item.seen && item.seen.length < 80) {
      products.push(item.seen);
    }
    const host = item.entityKey?.match(/https?:\/\/([^/\s]+)/i)?.[1];
    if (host) sources.push(host.replace(/^www\./, ""));
    const query = blob.match(/query[=:]+\s*([^|]+)/i)?.[1];
    if (query) queries.push(query.trim());
  }

  return {
    brands: unique(brands).slice(0, 8),
    products: unique(products).slice(0, 8),
    sources: unique(sources).slice(0, 8),
    queries: unique(queries).slice(0, 8),
    axes: axes.slice(0, 8),
  };
}

export function pickNextAxis(input: {
  recentAxes: ExplorationAxis[];
  lastOutcome?: string;
  lastNext?: string;
}): ExplorationAxis {
  const recent = input.recentAxes.slice(0, 6);
  const last = recent[0];
  const failed =
    /duplicate|no durable|no_search|insufficient|0 new/i.test(
      input.lastOutcome || "",
    );

  if (failed && last) {
    const skip = EXPLORATION_AXES.filter((axis) => axis !== last);
    const unused = skip.find((axis) => !recent.includes(axis));
    return unused || skip[0];
  }

  if (
    /competitor|rival|別ブランド/i.test(input.lastNext || "") &&
    !recent.includes("emerging_brands")
  ) {
    return "emerging_brands";
  }
  if (
    /review|reaction|other market|別地域/i.test(input.lastNext || "") &&
    !recent.includes("cross_region")
  ) {
    return "cross_region";
  }
  if (/retail|arrival|店/i.test(input.lastNext || "") && !recent.includes("local_retail")) {
    return "local_retail";
  }
  if (/media|press|story/i.test(input.lastNext || "") && !recent.includes("local_media")) {
    return "local_media";
  }

  const unused = EXPLORATION_AXES.find((axis) => !recent.includes(axis));
  if (unused) return unused;
  const nextIndex =
    (EXPLORATION_AXES.indexOf(last || "new_products") + 1) % EXPLORATION_AXES.length;
  return EXPLORATION_AXES[nextIndex];
}

function followUpQueries(seen: SeenExploration, axis: ExplorationAxis, city: string, beat: string) {
  const out: string[] = [];
  if (seen.brands[0] && axis === "emerging_brands") {
    out.push(`${seen.brands[0]} competitors ${beat} ${city}`);
  } else if (seen.brands[0] && axis === "new_products") {
    out.push(`${seen.brands[0]} new release ${beat}`);
  }
  if (seen.products[0] && axis === "cross_region") {
    out.push(`${seen.products[0]} ${beat} other market review`);
  }
  if (seen.sources[0] && axis === "local_media") {
    out.push(`${beat} ${city} related stories -site:${seen.sources[0]}`);
  }
  if (seen.products[0] && axis === "local_retail") {
    out.push(`${city} retailer new arrivals ${beat}`);
  }
  return unique(out).slice(0, 2);
}

function queryForSource(
  axis: ExplorationAxis,
  source: SourceClass,
  city: string,
  beat: string,
  language?: string | null,
) {
  const ja = (language || "").toLowerCase().startsWith("ja");
  const newWord = ja ? "新作" : "new";
  switch (source) {
    case "official":
      return `${city} ${beat} official ${newWord} product`;
    case "local_retail":
      return `${city} ${beat} shop new arrivals`;
    case "local_media":
      return `${city} ${beat} magazine news ${newWord}`;
    case "specialist_media":
      return `${beat} ${city} specialist review launch`;
    case "community":
      return `${city} ${beat} independent maker forum`;
    case "trend":
      return `${city} ${beat} trending this week`;
    case "startup":
      return `${beat} hardware startup ${city === "New York" ? "US" : city}`;
    case "indie_brand":
      return `${city} independent ${beat} brand ${newWord}`;
    case "marketplace":
      return `${city} ${beat} marketplace new listing -aliexpress`;
    default:
      return `${city} ${beat} ${axis.replace(/_/g, " ")}`;
  }
}

function domainsFor(city: string, sources: SourceClass[]) {
  const include: string[] = [];
  if (sources.includes("local_media") || sources.includes("specialist_media")) {
    include.push(...(LOCAL_MEDIA[city] ?? []));
  }
  if (sources.includes("local_retail") || sources.includes("marketplace")) {
    include.push(...(LOCAL_RETAIL[city] ?? []));
  }
  return unique(include).slice(0, 4);
}

function neighborRegion(identity: CorrespondentIdentity) {
  return (
    identity.territories.find(
      (place) => compact(place) !== compact(identity.city) && compact(place) !== compact(identity.countryName),
    ) || identity.territories[1] || "Japan"
  );
}

export function planTodayExploration(input: {
  persona: PersonaLens;
  experiences?: Experience[];
  recentQuests?: ExplorationQuest[];
  date?: string;
}): ExplorationQuest {
  const identity = correspondentIdentityFromLens({
    username: input.persona.username,
    name: input.persona.name,
    role: input.persona.role,
    expertise: input.persona.expertise,
    interests: input.persona.interests,
    huntingSpecialty: input.persona.huntingSpecialty,
    countryCode: input.persona.countryCode,
    region: input.persona.region,
    languages: input.persona.languages,
    goals: input.persona.goals,
  });
  const date = input.date || new Date().toISOString().slice(0, 10);
  const seen = extractSeenEntities(input.experiences ?? []);
  const recentAxes = unique([
    ...(input.recentQuests ?? []).map((quest) => quest.axis),
    ...seen.axes,
  ]).filter(isExplorationAxis);
  const last = (input.experiences ?? [])[0];
  const axis = pickNextAxis({
    recentAxes,
    lastOutcome: last?.outcome,
    lastNext: last?.next,
  });
  const sources = AXIS_SOURCES[axis];
  const city = identity.city;
  const beat = identity.primaryBeat || (input.persona.expertise ?? [])[0] || "culture";
  const compare = axis === "cross_region" ? neighborRegion(identity) : city;
  const followUps = followUpQueries(seen, axis, city, beat);
  const avoidQueries = unique([
    ...seen.queries,
    ...(input.recentQuests ?? []).flatMap((quest) => quest.queries),
  ]).slice(0, 8);
  const rawQueries = unique([
    ...followUps,
    ...sources.map((source) =>
      queryForSource(
        axis,
        source,
        axis === "cross_region" ? compare : city,
        beat,
        input.persona.languages?.[0],
      ),
    ),
  ]).filter((query) => !avoidQueries.some((old) => compact(old) === compact(query)));

  const queries = (rawQueries.length ? rawQueries : [
    queryForSource(axis, sources[0], city, beat, input.persona.languages?.[0]),
  ]).slice(0, 3);

  const includeDomains =
    axis === "cross_region" ? [] : domainsFor(city, sources);
  const excludeDomains = unique([
    ...SPAM_DOMAINS,
    ...OTHER_CITIES.filter((place) => compact(place) !== compact(city)).flatMap(
      (place) => LOCAL_MEDIA[place] ?? [],
    ),
  ]);

  const goal = AXIS_GOALS[axis](axis === "cross_region" ? compare : city, beat);
  const reason = last?.next
    ? `Yesterday led here: ${last.next}. Axis ${axis} so ${city} ${beat} does not repeat the same search.`
    : `I am ${identity.title}. Today ${axis.replace(/_/g, " ")} in ${city}.`;

  return {
    date,
    resident: input.persona.name,
    role: input.persona.role || "general_user",
    axis,
    goal,
    region: identity.countryName || identity.city,
    city,
    beat,
    sources,
    reason,
    queries,
    terms: unique([
      city,
      beat,
      axis.replace(/_/g, " "),
      ...followUps.flatMap((item) => item.split(/\s+/).filter((token) => token.length > 3)),
    ]).slice(0, 6),
    followUps,
    avoidQueries,
    avoidEntities: unique([...seen.brands, ...seen.products]).slice(0, 10),
    includeDomains,
    excludeDomains,
  };
}

export function nextExplorationHint(quest: ExplorationQuest, outcome: {
  newCount?: number;
  posted?: boolean;
  brands?: string[];
  sources?: string[];
}) {
  const brand = quest.avoidEntities[0] || outcome.brands?.[0];
  if ((outcome.newCount ?? 0) === 0) {
    return `leave ${quest.axis}; try a neighboring source class in ${quest.city}`;
  }
  if (quest.axis === "new_products" && brand) {
    return `${brand} competitors / other market reaction`;
  }
  if (quest.axis === "local_media") {
    return `retailer new arrivals after ${quest.city} press`;
  }
  if (outcome.posted) {
    return `do not repeat this candidate; look at related ${quest.beat} elsewhere`;
  }
  return `continue ${quest.beat} from ${quest.city} on a different axis`;
}

export function serializeExploration(quest: ExplorationQuest) {
  return JSON.stringify(quest);
}

export function parseExploration(value: string | null | undefined): ExplorationQuest | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as ExplorationQuest;
    if (!parsed?.axis || !parsed.goal || !Array.isArray(parsed.queries)) return null;
    if (!isExplorationAxis(parsed.axis)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function subjectLooksRepeated(
  subject: { productUrl?: string | null; sourceUrl?: string | null; brand?: string; productName?: string; label?: string },
  avoidEntities: string[],
) {
  const haystack = compact(
    [
      subject.productUrl,
      subject.sourceUrl,
      subject.brand,
      subject.productName,
      subject.label,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!haystack) return false;
  return avoidEntities.some((item) => {
    const token = compact(item);
    return token.length >= 4 && haystack.includes(token);
  });
}

export function isLowValueComment(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 16) return true;
  return /^(すごい|面白い|かわいい|いいね|好き|最高|amazing|awesome|love this|so cool|nice|great)[!！.。\s❤♥♡]*$/i.test(
    trimmed,
  );
}

export function commentHasInformationValue(text: string) {
  if (isLowValueComment(text)) return false;
  return /[?？]|compared|vs\b|than|still|yet|in (london|seoul|tokyo|paris|milan|bangkok|new york)|日本|韓国|現地|まだ|先に|素材|成分|価格|値段|作り|発売|compared to|not yet|already/i.test(
    text,
  );
}
