/** Shared types + stock photo sources for JP natural-image pipeline. */
import { resolve } from "node:path";

export type CandidateCat = "fashion" | "beauty" | "food" | "lifestyle" | "home";

export type CandidateStatus = "pending" | "approved" | "rejected";

export type CandidateRow = {
  id: string;
  cat: CandidateCat;
  theme: string;
  note: string;
  source: "pexels" | "unsplash";
  sourceUrl: string;
  localFile: string;
  status: CandidateStatus;
  rejectReason?: string;
  reviewedAt?: string;
};

export type Manifest = {
  version: 2;
  deprecatedGenPrefix: "gen:";
  createdAt: string;
  updatedAt: string;
  candidates: CandidateRow[];
};

export const CANDIDATE_DIR = resolve("tmp/jp-candidates-v2");
export const MANIFEST_PATH = resolve(CANDIDATE_DIR, "manifest.json");
export const REVIEW_HTML = resolve(CANDIDATE_DIR, "review.html");

/** How many reachable stock URLs to try downloading per category. */
export const FETCH_TARGETS: Record<CandidateCat, number> = {
  fashion: 100,
  beauty: 40,
  food: 30,
  lifestyle: 25,
  home: 15,
};

/** Theme/note pools — no place names; must match post types in seed-jp. */
export const THEMES: Record<CandidateCat, Array<{ theme: string; note: string }>> = {
  fashion: [
    { theme: "今日のコーデ", note: "鏡越しのシンプルコーデ" },
    { theme: "今日のコーデ", note: "淡色ニットとデニム" },
    { theme: "上半身コーデ", note: "カジュアルなトップス合わせ" },
    { theme: "全身コーデ", note: "休日の街歩きスタイル" },
    { theme: "きれいめカジュアル", note: "シャツとパンツの仕事寄り" },
    { theme: "バッグコーデ", note: "ショルダーバッグを持った一枚" },
    { theme: "腕時計コーデ", note: "細い腕時計の手元" },
    { theme: "スニーカーコーデ", note: "白スニーカーの足元" },
    { theme: "アクセサリー", note: "ネックレスとシンプル服" },
    { theme: "カフェコーデ", note: "カフェ席でのファッション" },
    { theme: "購入品", note: "最近買った服の試着" },
    { theme: "普段着", note: "休日のゆるコーデ" },
  ],
  beauty: [
    { theme: "リップ", note: "今日のリップ色" },
    { theme: "今日のメイク", note: "ナチュラルメイク" },
    { theme: "コスメ", note: "ポーチの中身" },
    { theme: "スキンケア", note: "朝のスキンケア" },
    { theme: "ネイル", note: "短めネイル" },
    { theme: "チーク", note: "血色感のチーク" },
  ],
  food: [
    { theme: "カフェ", note: "窓際のカフェ時間" },
    { theme: "スイーツ", note: "カフェのスイーツ" },
    { theme: "抹茶", note: "抹茶ラテ" },
    { theme: "ランチ", note: "休日のランチ" },
  ],
  lifestyle: [
    { theme: "購入品", note: "今日の購入品メモ" },
    { theme: "バッグの中身", note: "ポーチと小物" },
    { theme: "休日", note: "のんびりした午後" },
  ],
  home: [
    { theme: "部屋", note: "デスク周り" },
    { theme: "雑貨", note: "小さなインテリア更新" },
  ],
};

/** Curated Pexels IDs (real photos, same class as overseas Unsplash demo). */
export const PEXELS: Record<CandidateCat, number[]> = {
  fashion: [
    7671166, 9558761, 9558575, 9558601, 9558787, 7671168, 7671169, 9856354,
    1040945, 1926769, 298863, 934070, 1126993, 1462637, 1485031, 1759622,
    1852382, 2065200, 2129970, 2529148, 2690323, 2827400, 3094857, 3363728,
    3755706, 3768005, 3965545, 4210866, 4467687, 5119214, 5709661, 6311392,
    6311477, 6311586, 6311653, 6567607, 6626903, 6764007, 6764040, 7671186,
    7940621, 8532616, 9558571, 9558593, 9558607, 9558619, 9558630, 9558665,
    9558677, 9558689, 9558701, 9558713, 9558725, 9558763, 9558775, 9558786,
    9856351, 9856357, 9856360, 1007018, 1036623, 1043474, 1055691, 1183266,
    1307677, 1375849, 1462636, 1549200, 1689731, 1721558, 1844012, 1898555,
    2010812, 2043590, 2300334, 2466756, 2492109, 2657208, 3014856, 3206167,
    3311574, 3437204, 4937398, 4057322, 3209298, 7683754, 6311586, 7683756,
  ],
  beauty: [
    3373736, 3373745, 3373747, 3738347, 3738349, 3785147, 3993449, 4041392,
    415829, 457701, 5122188, 5939401, 6663469, 7242770, 8128069, 3373750,
    3738351, 3785151, 3993453, 4041396, 5122190, 5939405, 6663473, 7242774,
  ],
  food: [
    376464, 461198, 1639562, 1640777, 1099680, 1279330, 1833349, 2097090,
    2347311, 2641886, 2871757, 3026808, 3184183, 3535384, 3758891, 4198026,
    4551832, 5560760, 6287295, 6419736, 7422160, 8471703, 1055272, 1509428,
  ],
  lifestyle: [
    1571460, 1648776, 1866149, 2082087, 245208, 271816, 276583, 1090638,
    1350789, 1457842, 1669799, 2029667, 2121121, 2343468, 2499060, 2826787,
    3201760, 3990359, 4050318, 4112237, 4352247, 4846097, 4846099, 1571468,
  ],
  home: [
    6480707, 6585763, 6758772, 6969831, 7031413, 7188330, 7319307, 7512043,
    8134848, 6480710, 6585765, 6758774, 6969834, 7031415, 7188332, 7512045,
  ],
};

/** Unsplash photo IDs — overlap with overseas demo pool. */
export const UNSPLASH: Record<CandidateCat, string[]> = {
  fashion: [
    "1521572163474-6864f9cf17ab", "1489987707025-afc232f7ea0f", "1490481651871-ab68de25d43d",
    "1515886657613-9f3515b0c78f", "1525507119028-ed4c629a60a3", "1519741497674-611481863552",
    "1475180098004-ca77a66827be", "1503342217505-b0a15ec3261c", "1562157873-818bc0726f68",
    "1576566588028-4147f3842f27", "1583292650898-7d22cd27ca6f", "1594633312681-425c7b97ccd1",
    "1515378791036-0648a3ef77b2", "1542291026-7eec264c27ff", "1496747611176-843222e1e57c",
    "1558769132-cb1aea458c5e", "1539109136881-3be0616acf4b", "1544441893-675973e31985",
  ],
  beauty: [
    "1556228720-195a672e8a03", "1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348",
    "1571781926291-c477ebfd024b", "1512496015851-a90fb479ba36", "1586495777744-4413f21062fa",
    "1608248543803-ba4f8c27ae75", "1487412947146-5bad2030bbda", "1563170351-be82bc888aa4",
  ],
  food: [
    "1495474472287-4d71bcdd2085", "1504674900247-0877df9cc836", "1512621776951-a57141f2eefd",
    "1476224203421-9ac39bcb3327", "1467003909585-2f8a72700288", "1551024506-0bccd828d307",
    "1563805042-7684c019e1cb", "1578985545062-69928b1d9587", "1499636134819-e0eb8aa2b809",
  ],
  lifestyle: [
    "1485955900006-10f4d324d411", "1434030216411-0b793f4b4173", "1484480974691-166ee2e27e3b",
    "1505691938895-1758d7feb511", "1555041469-a586c61ea9bc", "1493663284031-b7e3aefcae8e",
  ],
  home: [
    "1493663284031-b7e3aefcae8e", "1485955900006-10f4d324d411", "1505691938895-1758d7feb511",
    "1586023492125-27b2c045efd7", "1555041469-a586c61ea9bc",
  ],
};

export function unsplashUrl(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
}

export function pexelsUrl(id: number) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
}

export function themeFor(cat: CandidateCat, index: number) {
  const pool = THEMES[cat];
  return pool[index % pool.length]!;
}

export function safeFilename(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
