import type { HunterStrategy } from "@/lib/ai/hunter-strategies";

export type SpecialtyLane =
  | "beauty"
  | "beauty_tools"
  | "fashion"
  | "sneakers"
  | "tech"
  | "gaming"
  | "food"
  | "home"
  | "fitness"
  | "outdoor"
  | "japan"
  | "korea"
  | "indie"
  | "eu"
  | "luxury"
  | "earth"
  | "campus"
  | "gift"
  | "launch"
  | "archive"
  | "scent"
  | "pet"
  | "wellness"
  | "kids"
  | "stationery"
  | "garden"
  | "craft"
  | "world";

const USERNAME_LANE: Record<string, SpecialtyLane> = {
  mira_beauty_ai: "beauty",
  maya_beauty_ai: "beauty_tools",
  leo_fashion_ai: "fashion",
  sofia_fashion_ai: "fashion",
  nico_sneakers_ai: "sneakers",
  kai_tech_ai: "tech",
  liam_tech_ai: "tech",
  aria_aidevice_ai: "tech",
  jun_gaming_ai: "gaming",
  mei_food_ai: "food",
  riku_food_ai: "food",
  lina_home_ai: "home",
  clara_home_ai: "home",
  rio_fitness_ai: "fitness",
  jules_outdoor_ai: "outdoor",
  kenji_japan_ai: "japan",
  minji_korea_ai: "korea",
  harper_indie_ai: "indie",
  otto_eu_ai: "eu",
  vivian_luxury_ai: "luxury",
  sage_earth_ai: "earth",
  tomo_campus_ai: "campus",
  gina_gift_ai: "gift",
  rex_launch_ai: "launch",
  nora_archive_ai: "archive",
  elise_scent_ai: "scent",
  noah_world_ai: "world",
  hana_pet_ai: "pet",
  aya_wellness_ai: "wellness",
  sora_kids_ai: "kids",
  elena_stationery_ai: "stationery",
  theo_garden_ai: "garden",
  nia_craft_ai: "craft",
};

const REJECT: Record<SpecialtyLane, RegExp> = {
  beauty: /\bsneaker|tent|controller|keyboard|charger|fountain pen|stroller|planter\b/i,
  beauty_tools: /\bsneaker|tent|controller|keyboard|stroller|planter|yarn\b/i,
  fashion: /\bserum|moisturizer|niacinamide|charger|tent|keyboard|litter|planter\b/i,
  sneakers: /\bserum|perfume|extrait|tent|charger|planter|yarn|stroller\b/i,
  tech: /\bserum|jacket|loafer|perfume|extrait|tent|yarn|stroller|planter\b/i,
  gaming: /\bserum|perfume|loafer|planter|yarn|body oil\b/i,
  food: /\bcharger|sneaker|keyboard|stroller|tent|serum\b/i,
  home: /\bserum|sneaker|controller|charger|stroller\b/i,
  fitness: /\bserum|perfume|keyboard|planter|yarn\b/i,
  outdoor: /\bserum|perfume|keyboard|stroller|lipstick\b/i,
  japan: /\bcharger|controller|stroller\b/i,
  korea: /\bcharger|tent|controller\b/i,
  indie: /\baliexpress|made-in-china|temu\b/i,
  eu: /\bjacket\b|sneaker|serum|charger|controller|loafer|extrait\b/i,
  luxury: /\btemu|aliexpress|charger|tent\b/i,
  earth: /\bcharger|sneaker collab|controller\b/i,
  campus: /\bhaute|extrait|ultralight tent\b/i,
  gift: /\bcharger cable|firmware\b/i,
  launch: /\barchive reissue only\b/i,
  archive: /\bjust launched firmware\b/i,
  scent: /\bsneaker|jacket|charger|tent|keyboard\b/i,
  pet: /\bserum|sneaker|charger|keyboard\b/i,
  wellness: /\bcontroller|sneaker|charger|tent\b/i,
  kids: /\bextrait|firmware|charger\b/i,
  stationery: /\bcharger|sneaker|tent|serum|stroller\b/i,
  garden: /\bserum|sneaker|charger|keyboard\b/i,
  craft: /\bcharger|sneaker|firmware|stroller\b/i,
  world: /$^/,
};

const ACCEPT: Record<SpecialtyLane, RegExp> = {
  beauty: /serum|moistur|skincare|cosmetic|makeup|ingredient|niacinamide|beauty|コスメ|美容|化粧水/,
  beauty_tools: /beauty device|hair dryer|facial|led mask|straightener|skin tool|haircare/,
  fashion: /jacket|leather|atelier|silhouette|apparel|fashion|ss2[0-9]|loafer|strap|earring|belt|服|カット/,
  sneakers: /sneaker|colorway|trainer|kicks|air max|collab pair|靴/,
  tech: /gadget|electronic|audio|headphone|keyboard|charger|firmware|usb|dac|battery|device|power.?bank|mouse|ssd|dock|hub|storage/,
  gaming: /controller|handheld|gaming mouse|capture card|firmware|xbox|playstation|steam deck|dualsense/,
  food: /snack|soda|flavor|soy|miso|knife|pan|seasoning|食品|調味料|菓子/,
  home: /lamp|table|ceramic|organizer|shelf|tray|furniture|storage|lamp|インテリア|収納/,
  fitness: /recovery|training shoe|grip|session|fitness|training/,
  outdoor: /ultralight|tent|pack|dwr|trail|hiking|camp/,
  japan: /made in japan|産地|工房|日本製|export/,
  korea: /seoul|korean|29cm|korea|한국|\.kr\//,
  indie: /independent|small batch|maker|studio|shopify|brooklyn|oakland|needsupply/,
  eu: /european|industrial|design object|vitra|milan|furniture|lamp|object design|vienna|austria/,
  luxury: /atelier|craft|quiet luxury|leather goods|haute|maison/,
  earth: /repairable|recycled|traceable|refill|second life|b-corp/,
  campus: /dorm|student|compact|first apartment|muji|uniqlo/,
  gift: /gift|wrap|host gift|seasonal|giftable/,
  launch: /launched|release|new drop|first edition|202[5-9]/,
  archive: /reissue|archive|forgotten|original formula|revival|復刻/,
  scent: /parfum|extrait|perfume|fragrance|toilette|cologne|edt|edp|note|香水/,
  pet: /pet food|chew|litter|harness|ペット/,
  wellness: /bath|sleep|incense|body oil|wellness|入浴/,
  kids: /stroller|kids|rounded|washable|baby|キッズ/,
  stationery: /fountain pen|notebook|paper|ink|pen|文房具/,
  garden: /planter|drainage|pruner|soil|garden|鉢/,
  craft: /chisel|yarn|dye|bench tool|craft|workshop/,
  world: /./,
};

export function hunterLane(
  username: string | null | undefined,
  huntingSpecialty?: string,
): SpecialtyLane | null {
  const key = (username ?? "").trim().toLowerCase();
  if (key && USERNAME_LANE[key]) return USERNAME_LANE[key];
  const specialty = (huntingSpecialty ?? "").toLowerCase();
  if (/sneaker/.test(specialty)) return "sneakers";
  if (/beauty|skincare|cosmetic/.test(specialty)) return "beauty";
  if (/fragrance|perfume|scent/.test(specialty)) return "scent";
  if (/fashion|jacket|apparel/.test(specialty)) return "fashion";
  if (/gadget|tech|audio/.test(specialty)) return "tech";
  if (/food|snack|kitchen/.test(specialty)) return "food";
  if (/outdoor|camp/.test(specialty)) return "outdoor";
  if (/stationer|pen/.test(specialty)) return "stationery";
  return null;
}

export function textFitsHunterSpecialty(input: {
  text: string;
  username?: string | null;
  huntingSpecialty?: string;
  strategy?: HunterStrategy | null;
}): boolean {
  const lane = hunterLane(input.username, input.huntingSpecialty);
  if (!lane || lane === "world") return true;
  const haystack = input.text;
  if (REJECT[lane]?.test(haystack)) return false;
  if (ACCEPT[lane]?.test(haystack)) return true;
  const vocabulary = input.strategy?.searchVocabulary ?? [];
  return vocabulary.some((term) => {
    const token = term.trim().toLowerCase();
    return token.length >= 3 && haystack.toLowerCase().includes(token);
  });
}

export function resultFitsHunterSpecialty(input: {
  title: string;
  url: string;
  snippet?: string;
  username?: string | null;
  huntingSpecialty?: string;
  strategy?: HunterStrategy | null;
}): boolean {
  return textFitsHunterSpecialty({
    text: `${input.title}\n${input.url}\n${input.snippet ?? ""}`,
    username: input.username,
    huntingSpecialty: input.huntingSpecialty,
    strategy: input.strategy,
  });
}

export function specialtyFitScore(input: {
  brand: string;
  productName: string;
  url: string;
  description?: string;
  username?: string | null;
  huntingSpecialty?: string;
  strategy?: HunterStrategy | null;
}): number {
  const text = `${input.brand} ${input.productName} ${input.url} ${input.description ?? ""}`;
  if (!textFitsHunterSpecialty({
    text,
    username: input.username,
    huntingSpecialty: input.huntingSpecialty,
    strategy: input.strategy,
  })) {
    return 20;
  }
  const lane = hunterLane(input.username, input.huntingSpecialty);
  if (!lane || lane === "world") return 70;
  let score = 55;
  if (ACCEPT[lane]?.test(text)) score += 20;
  const hits = (input.strategy?.searchVocabulary ?? []).filter((term) =>
    text.toLowerCase().includes(term.toLowerCase()),
  ).length;
  score += Math.min(20, hits * 8);
  return Math.min(100, score);
}

export function isMarketplaceProductUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)(amazon\.|aliexpress|ebay\.|made-in-china|temu\.|shein\.|dhgate|walmart\.|target\.com)/i.test(
      host,
    );
  } catch {
    return false;
  }
}
