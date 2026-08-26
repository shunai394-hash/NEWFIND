import type { AccountType, CategoryId, Comment, Post, Profile } from "@/lib/types";

/** Demo rows are identifiable so they can be upserted or removed without touching real users. */
export const DEMO_USERNAME_PREFIX = "nfdemo_";
export const DEMO_EMAIL_DOMAIN = "nfdemo.invalid";
export const DEMO_PROFILE_ID_PREFIX = "a0000000-0000-4000-8000-";
export const DEMO_POST_ID_PREFIX = "b0000000-0000-4000-8000-";
export const DEMO_COMMENT_ID_PREFIX = "c0000000-0000-4000-8000-";

export function demoProfileId(n: number) {
  return `${DEMO_PROFILE_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoPostId(n: number) {
  return `${DEMO_POST_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoCommentId(n: number) {
  return `${DEMO_COMMENT_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoEmail(username: string) {
  return `${username}@${DEMO_EMAIL_DOMAIN}`;
}

export function isDemoProfileId(id: string) {
  return id.startsWith(DEMO_PROFILE_ID_PREFIX);
}

export function isDemoPostId(id: string) {
  return id.startsWith(DEMO_POST_ID_PREFIX);
}

export function isDemoCommentId(id: string) {
  return id.startsWith(DEMO_COMMENT_ID_PREFIX);
}

export function isDemoUsername(username: string) {
  return username.startsWith(DEMO_USERNAME_PREFIX);
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function pickCount(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

type ProfileSeed = {
  n: number;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  accountType: AccountType;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
};

const PROFILE_DEFS: ProfileSeed[] = [
  {
    n: 1,
    slug: "mei",
    displayName: "Mei",
    bio: "日常で見つけた、ちょっと良いもの。",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 2,
    slug: "kaito",
    displayName: "Kaito",
    bio: "デスク周りと小さなガジェットが好き。",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 3,
    slug: "yui",
    displayName: "Yui",
    bio: "朝のスキンケアと、薄いメイクの記録。",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 4,
    slug: "haruto",
    displayName: "Haruto",
    bio: "週末は山とコーヒー。装備は最小限。",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 5,
    slug: "sora",
    displayName: "Sora",
    bio: "旅先で買った雑貨と、駅前のパン。",
    avatarUrl: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 6,
    slug: "rina",
    displayName: "Rina",
    bio: "着回ししやすい服だけ残す。",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 7,
    slug: "daiki",
    displayName: "Daiki",
    bio: "自室の照明と、静かなスピーカー。",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 8,
    slug: "nao",
    displayName: "Nao",
    bio: "夜のランと、翌朝のストレッチ。",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 9,
    slug: "kota",
    displayName: "Kota",
    bio: "カメラは小さく、写真は多く。",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 10,
    slug: "mika",
    displayName: "Mika",
    bio: "台所の道具を、少しずつ入れ替える。",
    avatarUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 11,
    slug: "ren",
    displayName: "Ren",
    bio: "街歩きと、本屋の隅の椅子。",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 12,
    slug: "ayaka",
    displayName: "Ayaka",
    bio: "リップとネイルだけ、気分で変える。",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 13,
    slug: "shun",
    displayName: "Shun",
    bio: "自転車通勤と、雨の日のジャケット。",
    avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 14,
    slug: "emi",
    displayName: "Emi",
    bio: "植物と、白い器。",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 15,
    slug: "taku",
    displayName: "Taku",
    bio: "仕事用ノートを、年に一台だけ替える。",
    avatarUrl: "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 16,
    slug: "hana",
    displayName: "Hana",
    bio: "旅の途中で飲む、変哲のないコーヒー。",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
  },
  {
    n: 17,
    slug: "nordic",
    displayName: "Nordic Home",
    bio: "北欧の暮らしの道具。",
    avatarUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "Nordic Home",
    companyWebsite: "https://www.muji.com/",
    companyDescription: "暮らしの道具を紹介するブランドアカウント。",
  },
  {
    n: 18,
    slug: "glowlab",
    displayName: "GLOW LAB",
    bio: "スキンケアと朝の光。",
    avatarUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "GLOW LAB",
    companyWebsite: "https://www.brandbridge.jp",
    companyDescription: "BrandBridge掲載ブランドの公式アカウント。",
  },
  {
    n: 19,
    slug: "beanandco",
    displayName: "Bean & Co",
    bio: "小さな焙煎所の日々。",
    avatarUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "Bean & Co",
    companyWebsite: "https://www.starbucks.co.jp/",
    companyDescription: "コーヒーと器を扱うショップ。",
  },
  {
    n: 20,
    slug: "atelier",
    displayName: "ATELIER 09",
    bio: "シーズンレスのシャツとパンツ。",
    avatarUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "ATELIER 09",
    companyWebsite: "https://www.uniqlo.com/",
    companyDescription: "日常着のブランドアカウント。",
  },
  {
    n: 21,
    slug: "trailkit",
    displayName: "TRAIL KIT",
    bio: "軽量な山道具だけを選ぶ。",
    avatarUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "TRAIL KIT",
    companyWebsite: "https://www.patagonia.com/",
    companyDescription: "アウトドア用品のセレクトショップ。",
  },
  {
    n: 22,
    slug: "deskcraft",
    displayName: "Deskcraft",
    bio: "机の上を、少しだけ整える。",
    avatarUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "Deskcraft",
    companyWebsite: "https://www.apple.com/",
    companyDescription: "デスク周りの道具を扱うブランド。",
  },
  {
    n: 23,
    slug: "linenhouse",
    displayName: "LINEN HOUSE",
    bio: "リネンと、午後の光。",
    avatarUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "LINEN HOUSE",
    companyWebsite: "https://www.ikea.com/",
    companyDescription: "寝具とファブリックのショップ。",
  },
  {
    n: 24,
    slug: "sipstudio",
    displayName: "SIP STUDIO",
    bio: "小さな瓶の、香りの記録。",
    avatarUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "SIP STUDIO",
    companyWebsite: "https://www.sephora.com/",
    companyDescription: "フレグランスとボディケア。",
  },
  {
    n: 25,
    slug: "orbitwatch",
    displayName: "ORBIT",
    bio: "毎日見る時計だけを残す。",
    avatarUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "ORBIT",
    companyWebsite: "https://www.casio.com/",
    companyDescription: "ウォッチブランドの公式アカウント。",
  },
  {
    n: 26,
    slug: "papermoon",
    displayName: "Paper Moon",
    bio: "ノートとペンの組み合わせ。",
    avatarUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "Paper Moon",
    companyWebsite: "https://www.muji.com/",
    companyDescription: "文具と紙もの。",
  },
];

const IMAGES: Partial<Record<CategoryId, string[]>> = {
  fashion: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&q=80",
  ],
  beauty: [
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1200&q=80",
  ],
  food: [
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
  ],
  home: [
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80",
  ],
  tech: [
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80",
  ],
  sports: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80",
  ],
  lifestyle: [
    "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1200&q=80",
  ],
  travel: [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
  ],
  other: [
    "https://images.unsplash.com/photo-1453928582365-b6ad33cbcf64?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
  ],
};

const VIDEO = {
  // Google gtv sample bucket now returns 403; use a stable public MP4.
  url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  thumb: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=1200&q=80",
};

const CAPTIONS: Partial<Record<CategoryId, string[]>> = {
  fashion: [
    "洗ったあとの落ち感が好きな白T。毎日これでいい。",
    "薄手のシャツ。畳まずに掛けると形が残る。",
    "裾だけ少し長いデニム。靴が見えるくらいがちょうどいい。",
    "一枚で終わるジャケット。春先の温度差に合う。",
    "色を増やさず、形だけ変えた。",
  ],
  beauty: [
    "朝いちの保湿。公式ページから詳細を確認できます。",
    "リップの発色だけ見に来て、結局これになった。",
    "香りが残らない乳液。昼まで顔がつっぱらない。",
    "薄い下地だけで十分だった日。",
    "夜のクレンジングを、一段やさしくした。",
  ],
  food: [
    "近所の焙煎。このカップがちょうどいい大きさ。",
    "焼きたてより、冷めてからの方が好きなパン。",
    "出汁だけ効いた、昼のうどん。",
    "甘いものを控えて、果実だけにした午後。",
    "瓶のジャムを、パンではなくヨーグルトに。",
  ],
  home: [
    "午後の光が合うソファ。週末はこの角度で。",
    "窓辺のグリーン。鉢の質感が部屋を落ち着かせる。",
    "棚の高さを変えただけで、部屋が広く見えた。",
    "リネンのカバーを替えたら、朝が少し早く感じた。",
    "照明を一つ減らして、影を残した。",
  ],
  tech: [
    "作業用ノート。ファンの音が小さくて集中できる。",
    "ケーブルを机の裏に隠した。それだけ。",
    "キーボードの沈みが浅くて、夜も打ちやすい。",
    "画面を一つにしたら、視線が落ち着いた。",
    "充電が一晩で足りるバッテリー。",
  ],
  sports: [
    "週末のラン。軽くて沈まないシューズ。",
    "雨のあとのトレイル。靴底だけ選んだ。",
    "ストレッチ用のマット。厚すぎない。",
    "夜の自転車。ライトの幅がちょうどいい。",
    "水を持ち歩きやすいボトルに替えた。",
  ],
  lifestyle: [
    "手帳の1ページを、予定ではなく感想に使った。",
    "ペン先が細くて、余白が書きやすい。",
    "朝の机に、本を一冊だけ置いた。",
    "買い物袋を畳んで、ジャケットの内ポケットへ。",
    "夜は音を小さくして、湯を沸かす。",
  ],
  travel: [
    "駅前で降りて、川沿いだけ歩いた。",
    "宿の窓から見えた、普通の屋根。",
    "空港の前に、パンを一つだけ買った。",
    "地図を閉じたあとに見つけた坂。",
    "帰りの車内で、缶コーヒーが一番うまかった。",
  ],
  other: [
    "名前のない道具。手に馴染むまで置いておく。",
    "箱を開けた瞬間の、紙の匂い。",
    "今日は何も足さなかった。",
    "机の端に置いた石。理由はない。",
  ],
};

const COMMENT_BODIES = [
  "これ欲しい。生地感わかります？",
  "色が部屋に合いそう。",
  "リンク先見てみます。",
  "同じ系統、探していました。",
  "朝の光との相性が良さそう。",
  "サイズ感だけ知りたいです。",
  "保存しました。",
  "公式の説明、わかりやすい。",
  "週末に試してみます。",
  "写真の角度、参考になります。",
];

const PRODUCT_LINKS: Partial<Record<CategoryId, { url: string; label: string }>> = {
  fashion: { url: "https://www.uniqlo.com/", label: "商品を見る" },
  beauty: { url: "https://www.sephora.com/", label: "商品を見る" },
  food: { url: "https://www.starbucks.co.jp/", label: "商品を見る" },
  home: { url: "https://www.ikea.com/", label: "商品を見る" },
  tech: { url: "https://www.apple.com/", label: "商品を見る" },
  sports: { url: "https://www.nike.com/", label: "商品を見る" },
  lifestyle: { url: "https://www.muji.com/", label: "商品を見る" },
  travel: { url: "https://www.patagonia.com/", label: "商品を見る" },
  other: { url: "https://www.muji.com/", label: "商品を見る" },
};

function buildProfiles(): Profile[] {
  return PROFILE_DEFS.map((def) => ({
    id: demoProfileId(def.n),
    username: `${DEMO_USERNAME_PREFIX}${def.slug}`,
    displayName: def.displayName,
    bio: def.bio,
    avatarUrl: def.avatarUrl,
    accountType: def.accountType,
    companyName: def.companyName ?? null,
    companyWebsite: def.companyWebsite ?? null,
    companyDescription: def.companyDescription ?? null,
    instagramUrl: null,
    xUrl: null,
    tiktokUrl: null,
    youtubeUrl: null,
    websiteUrl: null,
    createdAt: `2026-07-${String(10 + (def.n % 18)).padStart(2, "0")}T09:00:00.000Z`,
  }));
}

function buildPosts(profiles: Profile[]): Post[] {
  const rng = mulberry32(20260823);
  const categories: CategoryId[] = [
    "fashion",
    "beauty",
    "food",
    "home",
    "tech",
    "sports",
    "lifestyle",
    "travel",
    "other",
  ];
  const posts: Post[] = [];
  const total = 156;

  for (let i = 1; i <= total; i += 1) {
    const author = profiles[(i - 1) % profiles.length]!;
    const category = categories[(i - 1) % categories.length]!;
    const images = IMAGES[category]!;
    const isVideo = i % 37 === 0;
    const hasProduct = i % 3 !== 0;
    const isSponsored = i % 7 === 0;
    const isBrandbridge = author.accountType === "business" && i % 5 === 0;
    const product = PRODUCT_LINKS[category]!;
    const day = 1 + ((i * 3) % 22);
    const hour = 8 + (i % 12);
    const minute = (i * 7) % 60;

    posts.push({
      id: demoPostId(i),
      authorId: author.id,
      mediaType: isVideo ? "video" : "photo",
      mediaUrl: isVideo ? VIDEO.url : images[(i + Math.floor(rng() * 3)) % images.length]!,
      thumbnailUrl: isVideo ? VIDEO.thumb : null,
      caption: CAPTIONS[category]![(i + author.username.length) % CAPTIONS[category]!.length]!,
      category,
      productUrl: hasProduct ? (isBrandbridge ? "https://www.brandbridge.jp" : product.url) : null,
      productLabel: hasProduct ? product.label : null,
      isSponsored,
      source: isBrandbridge ? "brandbridge" : "user",
      sourceRef: isBrandbridge ? `bb-${category}-${String(i).padStart(3, "0")}` : null,
      sourceUrl: isBrandbridge ? "https://www.brandbridge.jp" : null,
      createdAt: `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
    });
  }

  return posts;
}

function buildFollows(profiles: Profile[]): Array<{ followerId: string; followeeId: string }> {
  const rng = mulberry32(77);
  const follows: Array<{ followerId: string; followeeId: string }> = [];
  const seen = new Set<string>();

  for (const follower of profiles) {
    const count = pickCount(rng, 4, 9);
    for (let i = 0; i < count; i += 1) {
      const followee = pick(rng, profiles);
      if (followee.id === follower.id) continue;
      const key = `${follower.id}:${followee.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      follows.push({ followerId: follower.id, followeeId: followee.id });
    }
  }

  return follows;
}

function buildReactions(profiles: Profile[], posts: Post[]) {
  const rng = mulberry32(99);
  const likes: Array<{ userId: string; postId: string }> = [];
  const wants: Array<{ userId: string; postId: string }> = [];
  const saves: Array<{ userId: string; postId: string }> = [];
  const comments: Comment[] = [];
  let commentN = 1;

  for (const post of posts) {
    const likeCount = pickCount(rng, 0, 14);
    const wantCount = pickCount(rng, 0, 7);
    const saveCount = pickCount(rng, 0, 5);
    const commentCount = pickCount(rng, 0, 4);
    const usedLikes = new Set<string>();
    const usedWants = new Set<string>();
    const usedSaves = new Set<string>();

    for (let i = 0; i < likeCount; i += 1) {
      const user = pick(rng, profiles);
      if (usedLikes.has(user.id)) continue;
      usedLikes.add(user.id);
      likes.push({ userId: user.id, postId: post.id });
    }
    for (let i = 0; i < wantCount; i += 1) {
      const user = pick(rng, profiles);
      if (usedWants.has(user.id)) continue;
      usedWants.add(user.id);
      wants.push({ userId: user.id, postId: post.id });
    }
    for (let i = 0; i < saveCount; i += 1) {
      const user = pick(rng, profiles);
      if (usedSaves.has(user.id)) continue;
      usedSaves.add(user.id);
      saves.push({ userId: user.id, postId: post.id });
    }
    for (let i = 0; i < commentCount; i += 1) {
      const user = pick(rng, profiles);
      comments.push({
        id: demoCommentId(commentN),
        userId: user.id,
        postId: post.id,
        body: COMMENT_BODIES[(commentN + i) % COMMENT_BODIES.length]!,
        createdAt: post.createdAt,
      });
      commentN += 1;
    }
  }

  return { likes, wants, saves, comments };
}

export const SEED_PROFILES: Profile[] = buildProfiles();
export const SEED_POSTS: Post[] = buildPosts(SEED_PROFILES);
const reactions = buildReactions(SEED_PROFILES, SEED_POSTS);
export const SEED_FOLLOWS = buildFollows(SEED_PROFILES);
export const SEED_LIKES = reactions.likes;
export const SEED_WANTS = reactions.wants;
export const SEED_SAVES = reactions.saves;
export const SEED_COMMENTS: Comment[] = reactions.comments;
