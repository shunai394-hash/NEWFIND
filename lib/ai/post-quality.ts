const GENERIC_OPENINGS = [
  /^今日見つけた/,
  /^見つけました/,
  /^気になりました/,
  /^ちょっと気になる/,
  /^面白い商品です/,
  /^これ、好き[。.]?$/,
  /^なんかいい感じ/,
  /^手元で見たい/,
  /^found this today/i,
  /^caught my eye/i,
  /^check this out/i,
  /^i found this/i,
  /^this is interesting/i,
  /^i want this in front of me/i,
  /^this feels like the current turn/i,
];

const GENERIC_PHRASES = [
  "見つけました",
  "気になりました",
  "面白い商品です",
  "ちょっと気になる",
  "なんかいい感じ",
  "手元で見たい",
  "found this today",
  "caught my eye",
  "pretty cool product",
  "this looks interesting",
  "i want this in front of me",
  "feels like the current turn",
];

const GENERIC_CTAS = [
  "チェックして",
  "見てみて",
  "link in bio",
  "tap the link",
  "今すぐチェック",
  "shop now",
];

const CONCRETE_SIGNAL =
  /\d|mm\b|ml\b|\bg\b|oz\b|sku|usb|leather|cotton|wool|steel|ceramic|serum|note|cut|last|port|weight|size|nylon|canvas|silk|resin|firmware|impedance|成分|素材|容量|型番|靴底|ノズル|キャップ|縫い|底|革|紙|インク|香|酸|より|than|vs\b|比べ/i;

export type CaptionQualityInput = {
  caption: string;
  role?: string | null;
  recentCaptions?: string[];
  productCaptions?: string[];
  subjectLabel?: string | null;
};

export type CaptionQualityResult = {
  ok: boolean;
  reason?: string;
  needsRewrite: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[、。,.!！?？「」『』"'“”]/g, "");
}

function openingOf(value: string) {
  return normalize(value).slice(0, 18);
}

export function captionHasConcreteObservation(caption: string) {
  const trimmed = caption.trim();
  if (!trimmed) return false;
  return CONCRETE_SIGNAL.test(trimmed);
}

export function captionIsGeneric(caption: string) {
  const trimmed = caption.trim();
  if (!trimmed) return true;
  if (GENERIC_OPENINGS.some((pattern) => pattern.test(trimmed))) return true;
  const lowered = trimmed.toLowerCase();
  return GENERIC_PHRASES.some((phrase) => lowered.includes(phrase.toLowerCase()));
}

export function captionHasGenericCta(caption: string) {
  const lowered = caption.toLowerCase();
  return GENERIC_CTAS.some((cta) => lowered.includes(cta.toLowerCase()));
}

export function captionsAreTooSimilar(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 16 && right.length >= 16 && openingOf(a) === openingOf(b)) {
    return true;
  }
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return shorter.length >= 18 && longer.includes(shorter);
}

export function evaluateCaptionQuality(
  input: CaptionQualityInput,
): CaptionQualityResult {
  const caption = input.caption.trim();
  if (caption.length < 12) {
    return { ok: false, needsRewrite: true, reason: "too_short" };
  }
  if (captionIsGeneric(caption)) {
    return { ok: false, needsRewrite: true, reason: "generic_caption" };
  }
  if (!captionHasConcreteObservation(caption)) {
    return { ok: false, needsRewrite: true, reason: "no_concrete_observation" };
  }
  if (captionHasGenericCta(caption)) {
    return { ok: false, needsRewrite: true, reason: "generic_cta" };
  }
  if (
    input.subjectLabel &&
    captionsAreTooSimilar(caption, input.subjectLabel)
  ) {
    return { ok: false, needsRewrite: true, reason: "copies_subject" };
  }
  const pool = [
    ...(input.recentCaptions ?? []),
    ...(input.productCaptions ?? []),
  ];
  if (pool.some((other) => captionsAreTooSimilar(caption, other))) {
    return { ok: false, needsRewrite: true, reason: "similar_caption" };
  }
  return { ok: true, needsRewrite: false };
}

export function roleCaptionLens(role: string | null | undefined) {
  switch (role) {
    case "product_hunter":
      return "Write the discovery story: what you searched, what was unusual, and why this object survived your filter. Name a material, spec, or construction detail. Never say you 'just found it'.";
    case "world_scout":
      return "Do not post. File a candidate with source URL, region, and why it is a seed rather than a finished story.";
    case "critic":
      return "Name a weakness, a questionable claim, or a comparison. Do not praise by default.";
    case "curator":
      return "Say why it belongs in today's NEWFIND, not why it is generally nice. Name a concrete trait.";
    case "influencer":
      return "Personal reaction and social context: who would notice it, where it would actually be worn or used. Name a detail.";
    case "reviewer":
      return "Evaluate: one strength, one limit, no invented hands-on test. Name a spec or material.";
    case "media":
      return "News context and why the object matters now. Do not treat a headline as the product.";
    case "trend_hunter":
      return "Why-now and the rising signal. Do not announce a random object as a trend.";
    case "fan":
      return "A specific affection for a maker, material, or ritual. Not generic hype.";
    default:
      return "A short resident note with a specific observation. No template excitement.";
  }
}
