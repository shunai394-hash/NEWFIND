/**
 * One definition of the "decorative craft object" noise (craft bottles,
 * handmade vessels, pottery, ornaments) shared by the product hunter, the
 * posting gate and the homepage.
 *
 * Craft bottles kept returning because each gate had its own English-only
 * list: a Japanese caption such as 「クラフトボトル」 or 「手吹きガラスの花瓶」, or a
 * spelling the list missed, passed every gate. Functional products stay
 * eligible even when handmade (a handcrafted leather wallet, a travel
 * bottle, craft tools such as chisels or yarn).
 */

const EN_CRAFT_PREFIX =
  "(?:hand[\\s-]?made|hand[\\s-]?crafted|hand[\\s-]?blown|craft(?:ed)?|artisan(?:al)?|decorative|ceramic|pottery|glass\\s+art)";
const EN_OBJECT =
  "(?:glass\\s+)?(?:bottles?|vessels?|jars?|containers?|vases?|decor|ornaments?|objects?|objets?|crafts?)";

const DECORATIVE_CRAFT_PATTERNS: RegExp[] = [
  new RegExp(`\\b${EN_CRAFT_PREFIX}\\s+${EN_OBJECT}\\b`, "i"),
  /\bart\s+(?:bottle|vessel|object)s?\b/i,
  /\bceramic\s+tea\s+whisk\b/i,
  /\bpottery\b/i,
  /\bfigurines?\b/i,
  /\bornaments?\b/i,
  /\bresin\s+art\b/i,
  /\bwood\s+carvings?\b/i,
  /\bbud\s+vases?\b/i,
  // Japanese: crafted/handmade + bottle/vessel/decor. 器具/瓶詰め are tools and
  // jarred food, not decor.
  /(?:クラフト|ハンドメイド|手作り|手づくり|手仕事|手吹き|工芸|作家|アート|装飾)(?:の|な)?\s*(?:ガラス(?:の)?)?\s*(?:ボトル|瓶(?!詰)|びん(?!詰)|ビン(?!詰)|ベッセル|器(?![具械材])|うつわ|花瓶|花器|一輪挿し|オブジェ(?!クト)|置物)/,
  // Standalone decor nouns only; 陶器 alone also covers everyday mugs and plates.
  /陶芸|置物|オブジェ(?!クト)|一輪挿し/u,
];

/** True when the text describes a decorative craft object rather than a product people use. */
export function isDecorativeCraftObject(text: string | null | undefined): boolean {
  const value = (text ?? "").normalize("NFKC");
  if (!value.trim()) return false;
  return DECORATIVE_CRAFT_PATTERNS.some((pattern) => pattern.test(value));
}
