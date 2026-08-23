import type { AccountType, CategoryId, Comment, Post, Profile } from "@/lib/types";
import {
  JP_DEMO_VIDEO_CLIPS,
  type JpDemoVideoTheme,
} from "@/lib/seed-jp-videos.generated";
import {
  assertJpImageUniqueness,
  JP_IMAGES_BY_CATEGORY,
  type JpImageAsset,
} from "@/lib/seed-jp-images";

/** Japan youth demo rows — separate ID space from overseas nfdemo_*. */
export const DEMO_JP_USERNAME_PREFIX = "nfdemo_jp_";
export const DEMO_JP_PROFILE_ID_PREFIX = "a1000000-0000-4000-8000-";
export const DEMO_JP_REACTOR_ID_PREFIX = "a1100000-0000-4000-8000-";
export const DEMO_JP_POST_ID_PREFIX = "b1000000-0000-4000-8000-";
export const DEMO_JP_COMMENT_ID_PREFIX = "c1000000-0000-4000-8000-";

export function demoJpProfileId(n: number) {
  return `${DEMO_JP_PROFILE_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoJpReactorId(n: number) {
  return `${DEMO_JP_REACTOR_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoJpPostId(n: number) {
  return `${DEMO_JP_POST_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function demoJpCommentId(n: number) {
  return `${DEMO_JP_COMMENT_ID_PREFIX}${String(n).padStart(12, "0")}`;
}

export function isDemoJpProfileId(id: string) {
  return id.startsWith(DEMO_JP_PROFILE_ID_PREFIX) || id.startsWith(DEMO_JP_REACTOR_ID_PREFIX);
}

export function isDemoJpPostId(id: string) {
  return id.startsWith(DEMO_JP_POST_ID_PREFIX);
}

export function isDemoJpCommentId(id: string) {
  return id.startsWith(DEMO_JP_COMMENT_ID_PREFIX);
}

export function isDemoJpUsername(username: string) {
  return username.startsWith(DEMO_JP_USERNAME_PREFIX);
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

function pickCount(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

type Interest = CategoryId;

type ProfileDef = {
  n: number;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  accountType: AccountType;
  interest: Interest;
  companyName?: string;
  companyWebsite?: string;
  companyDescription?: string;
};

function av(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=80`;
}

/** One unique avatar per personal profile (no reuse across people). */
const UNIQUE_AVATARS = [
  "1534528741775-53994a69daeb",
  "1529626455594-4ff0802cfb7e",
  "1517841905240-472988babdf9",
  "1524504388940-b1c1722653e1",
  "1544005313-94ddf0286df2",
  "1487412720507-e7ab37603c6f",
  "1438761681033-6461ffad8d80",
  "1494790108377-be9c29b29330",
  "1531123897727-8f129e1688ce",
  "1521119989659-a83eee488004",
  "1580489944761-15a19d654956",
  "1573496359142-b8d87734a5a2",
  "1548142813-c348350df52b",
  "1506794778202-cad84cf45f1d",
  "1507003211169-0a1dd7228f2d",
  "1500648767791-00dcc994a43e",
  "1472099645785-5658abf4ff4e",
  "1539571696357-5a69c17a67c6",
  "1519345182560-3f2917c472ef",
  "1488426862026-3ee34a7d66df",
  "1492562080023-ab3db95bfbce",
  "1508214751196-bcfd4ea38f4d",
  "1546961329-3bef8717a6c8",
  "1552374196-c4e7ffc6e126",
  "1567532939604-dbd2efcecb47",
  "1573497019940-1c28c88b4f3e",
  "1586297135537-94bc9ba3bb30",
  "1594744803329-e29bb65cea55",
  "1607746882041-4e44314c54d4",
  "1619895862022-09114b5d9c96",
  "1622253692010-333f2da6031d",
  "1633332755192-727a05c4013d",
  "1639149888902-fcbbb6776433",
  "1525130413817-d45c1d127c42",
  "1544716272-e513ae4b9a3a",
  "1551836022-d5d88e9218df",
  "1554151228-14d9def656e4",
  "1560250097-0b93528c311a",
  "1570295999919-56ceb5ecca61",
  "1573497019236-17f669bae5b2",
  "1598550886615-5f694adc2464",
  "1603415526960-f7e0328c63b2",
  "1607990283143-e4f94371674e",
  "1499996861825-3031699edb00",
  "1463453091185-61582044d556",
  "1519085360753-af0119f7cbe7",
  "1487412947146-5bad2030bbda",
  "1492106087820-71f1a00d2b11",
  "1505944270255-72b8c68c50c5",
  "1515377905703-c4788e51af15",
  "1522337660859-02fbefca4702",
  "1535632066927-ab7c9ab60908",
  "1540555700478-4be289fbecef",
  "1556228578-0d85b1a4d571",
  "1563170351-be82bc888aa4",
  "1570172619644-dfd03ed5d881",
  "1596704017254-9b121068ec31",
  "1616683693504-3ea7e9ba6ced",
];

const PERSONAL: Array<Omit<ProfileDef, "n" | "avatarUrl" | "accountType"> & { interest: Interest }> = [
  { slug: "mei", displayName: "めい", bio: "大学生。淡色と韓国っぽコーデが好き。", interest: "fashion" },
  { slug: "yuna", displayName: "ゆな", bio: "通学コーデとスニーカー集め。", interest: "fashion" },
  { slug: "rina", displayName: "りな", bio: "きれいめカジュアル研究中。", interest: "fashion" },
  { slug: "akari", displayName: "あかり", bio: "ストリート寄りの休日コーデ。", interest: "fashion" },
  { slug: "mio", displayName: "みお", bio: "デートコーデとバッグ記録。", interest: "fashion" },
  { slug: "hina", displayName: "ひな", bio: "オフィスカジュアルの練習中。", interest: "fashion" },
  { slug: "sakura", displayName: "さくら", bio: "ワンピースと帽子が好き。", interest: "fashion" },
  { slug: "ayaka", displayName: "あやか", bio: "デニムとトップスの組み合わせ。", interest: "fashion" },
  { slug: "nana", displayName: "なな", bio: "夏コーデとアクセサリー。", interest: "fashion" },
  { slug: "reina", displayName: "れいな", bio: "大学生のカジュアル記録。", interest: "fashion" },
  { slug: "koharu", displayName: "こはる", bio: "10代後半のガーリーコーデ。", interest: "fashion" },
  { slug: "sora", displayName: "そら", bio: "韓国系ファッションをゆるく。", interest: "fashion" },
  { slug: "momo", displayName: "もも", bio: "バッグとスニーカー沼。", interest: "fashion" },
  { slug: "ichika", displayName: "いちか", bio: "きれいめ寄りの休日服。", interest: "fashion" },
  { slug: "himari", displayName: "ひまり", bio: "帽子とワンピの季節感。", interest: "fashion" },
  { slug: "aoi", displayName: "あおい", bio: "リップとチークの色見本。", interest: "beauty" },
  { slug: "emi", displayName: "えみ", bio: "プチプラコスメ購入品メモ。", interest: "beauty" },
  { slug: "risa", displayName: "りさ", bio: "韓国コスメとスキンケア。", interest: "beauty" },
  { slug: "mika", displayName: "みか", bio: "アイシャドウとマスカラ。", interest: "beauty" },
  { slug: "yui", displayName: "ゆい", bio: "ファンデーションと下地。", interest: "beauty" },
  { slug: "saki", displayName: "さき", bio: "ネイルとヘアケア。", interest: "beauty" },
  { slug: "honoka", displayName: "ほのか", bio: "日焼け止めと美容液。", interest: "beauty" },
  { slug: "kotone", displayName: "ことね", bio: "香水とポーチの中身。", interest: "beauty" },
  { slug: "noa", displayName: "のあ", bio: "デパコス系もたまに試す。", interest: "beauty" },
  { slug: "fuka", displayName: "ふうか", bio: "アイライナー細引き派。", interest: "beauty" },
  { slug: "chika", displayName: "ちか", bio: "GRWMと今日のメイク。", interest: "beauty" },
  { slug: "misa", displayName: "みさ", bio: "ティントリップ多め。", interest: "beauty" },
  { slug: "yume", displayName: "ゆめ", bio: "チークの位置研究。", interest: "beauty" },
  { slug: "airi", displayName: "あいり", bio: "カフェとコンビニスイーツ。", interest: "food" },
  { slug: "an", displayName: "あん", bio: "東京カフェ巡り。", interest: "food" },
  { slug: "nagi", displayName: "なぎ", bio: "抹茶と韓国フード。", interest: "food" },
  { slug: "miku", displayName: "みく", bio: "ランチとスイーツ記録。", interest: "food" },
  { slug: "hinata", displayName: "ひなた", bio: "新大久保ランチ多め。", interest: "food" },
  { slug: "suzuka", displayName: "すずか", bio: "部屋と休日の朝。", interest: "lifestyle" },
  { slug: "toha", displayName: "とは", bio: "推し活とバッグの中身。", interest: "lifestyle" },
  { slug: "kokona", displayName: "ここな", bio: "大学生活と購入品。", interest: "lifestyle" },
  { slug: "maho", displayName: "まほ", bio: "旅行と休日スナップ。", interest: "travel" },
  { slug: "eri", displayName: "えり", bio: "週末の小さな旅。", interest: "travel" },
  { slug: "kaho", displayName: "かほ", bio: "ガジェットとイヤホン。", interest: "tech" },
  { slug: "sara", displayName: "さら", bio: "デスク周りの小さな更新。", interest: "home" },
  { slug: "moe", displayName: "もえ", bio: "雑貨と気になったもの。", interest: "other" },
  { slug: "asuka", displayName: "あすか", bio: "オフィスカジュアル挑戦中。", interest: "fashion" },
  { slug: "riko", displayName: "りこ", bio: "アクセと帽子の組み合わせ。", interest: "fashion" },
  { slug: "nanami", displayName: "ななみ", bio: "韓国メイク薄め版。", interest: "beauty" },
  { slug: "yuina", displayName: "ゆいな", bio: "ヘアケアとネイル。", interest: "beauty" },
  { slug: "miyu", displayName: "みゆ", bio: "カフェの席と光。", interest: "food" },
  { slug: "ruka", displayName: "るか", bio: "購入品と休日。", interest: "lifestyle" },
  { slug: "shiori", displayName: "しおり", bio: "旅行の荷物は最小。", interest: "travel" },
  { slug: "haruka", displayName: "はるか", bio: "スマホケースとガジェット。", interest: "tech" },
  { slug: "ayane", displayName: "あやね", bio: "部屋の角だけ整える係。", interest: "home" },
  { slug: "ninon", displayName: "にのん", bio: "今日の服を短く残す。", interest: "fashion" },
  { slug: "remi", displayName: "れみ", bio: "リップとグロスの沼。", interest: "beauty" },
  { slug: "kanon", displayName: "かのん", bio: "スイーツよりドリンク派。", interest: "food" },
  { slug: "tsumugi", displayName: "つむぎ", bio: "推し色の小物集め。", interest: "lifestyle" },
  { slug: "io", displayName: "いお", bio: "夏コーデとサンダル。", interest: "fashion" },
  { slug: "riho", displayName: "りほ", bio: "スキンケアの順番メモ。", interest: "beauty" },
  { slug: "ume", displayName: "うめ", bio: "抹茶ラテ好き。", interest: "food" },
  { slug: "kota", displayName: "こた", bio: "カメラと旅行。", interest: "travel" },
];

const BUSINESS: Array<Omit<ProfileDef, "n" | "accountType"> & { avatarUrl: string }> = [
  {
    slug: "closetnote",
    displayName: "CLOSET NOTE",
    bio: "デイリーに着たい服のメモ帳。",
    avatarUrl: av("1441986300917-64674bd600d8"),
    interest: "fashion",
    companyName: "CLOSET NOTE",
    companyWebsite: "https://www.gu-global.com/jp/",
    companyDescription: "若年層向けコーディネート紹介。",
  },
  {
    slug: "palecloset",
    displayName: "pale closet",
    bio: "淡色とガーリーのセレクト。",
    avatarUrl: av("1489987707025-afc232f7ea0f"),
    interest: "fashion",
    companyName: "pale closet",
    companyWebsite: "https://grl.jp/",
    companyDescription: "ファッションセレクトのデモアカウント。",
  },
  {
    slug: "streetmini",
    displayName: "STREET MINI",
    bio: "スニーカーとカジュアル。",
    avatarUrl: av("1515886657613-9f3515b0c78f"),
    interest: "fashion",
    companyName: "STREET MINI",
    companyWebsite: "https://wego.jp/",
    companyDescription: "カジュアル寄りのショップアカウント。",
  },
  {
    slug: "pouchlab",
    displayName: "POUCH LAB",
    bio: "プチプラコスメの試し記録。",
    avatarUrl: av("1596462502278-27bfdc403348"),
    interest: "beauty",
    companyName: "POUCH LAB",
    companyWebsite: "https://www.canmake.com/",
    companyDescription: "コスメ紹介のデモアカウント。",
  },
  {
    slug: "lipnote",
    displayName: "LIP NOTE",
    bio: "リップとグロスの色見本。",
    avatarUrl: av("1522335789203-aabd1fc54bc9"),
    interest: "beauty",
    companyName: "LIP NOTE",
    companyWebsite: "https://www.cezanne.co.jp/",
    companyDescription: "リップ中心のデモショップ。",
  },
  {
    slug: "krbeauty",
    displayName: "KR BEAUTY",
    bio: "韓国コスメのパッケージが好き。",
    avatarUrl: av("1571781926291-c477ebfd024b"),
    interest: "beauty",
    companyName: "KR BEAUTY",
    companyWebsite: "https://www.etude.com/",
    companyDescription: "韓国コスメ紹介。",
  },
  {
    slug: "cafewalk",
    displayName: "CAFE WALK",
    bio: "東京カフェの席写真。",
    avatarUrl: av("1495474472287-4d71bcdd2085"),
    interest: "food",
    companyName: "CAFE WALK",
    companyWebsite: "https://www.starbucks.co.jp/",
    companyDescription: "カフェ巡りのデモアカウント。",
  },
  {
    slug: "roomnote",
    displayName: "ROOM NOTE",
    bio: "部屋とデスク周りの更新。",
    avatarUrl: av("1505691938895-1758d7feb511"),
    interest: "home",
    companyName: "ROOM NOTE",
    companyWebsite: "https://www.muji.com/jp/",
    companyDescription: "インテリア寄りのデモアカウント。",
  },
  {
    slug: "tripmemo",
    displayName: "TRIP MEMO",
    bio: "週末の小さな旅行メモ。",
    avatarUrl: av("1469854523086-cc02fe5d8800"),
    interest: "travel",
    companyName: "TRIP MEMO",
    companyWebsite: "https://www.jalan.net/",
    companyDescription: "旅行系のデモアカウント。",
  },
  {
    slug: "techdesk",
    displayName: "TECH DESK",
    bio: "スマホまわりの小さな道具。",
    avatarUrl: av("1517336714731-489689fd1ca8"),
    interest: "tech",
    companyName: "TECH DESK",
    companyWebsite: "https://www.apple.com/jp/",
    companyDescription: "ガジェット紹介のデモアカウント。",
  },
];

function buildProfileDefs(): ProfileDef[] {
  const personalAvatars = UNIQUE_AVATARS.filter(
    (id) => !BUSINESS.some((b) => b.avatarUrl.includes(id)),
  );
  if (personalAvatars.length < PERSONAL.length) {
    throw new Error(`Need ${PERSONAL.length} unique avatars, have ${personalAvatars.length}`);
  }
  const personal: ProfileDef[] = PERSONAL.map((p, i) => ({
    n: i + 1,
    slug: p.slug,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: av(personalAvatars[i]!),
    accountType: "personal",
    interest: p.interest,
  }));
  const business: ProfileDef[] = BUSINESS.map((b, i) => ({
    ...b,
    n: personal.length + i + 1,
    accountType: "business",
  }));
  const all = [...personal, ...business];
  const avatarSet = new Set(all.map((p) => p.avatarUrl));
  if (avatarSet.size !== all.length) {
    throw new Error("Duplicate avatarUrl among JP profiles");
  }
  return all;
}

const JP_PROFILES = buildProfileDefs();

const FASHION_BRANDS = [
  { name: "ZARA", url: "https://www.zara.com/jp/" },
  { name: "H&M", url: "https://www2.hm.com/ja_jp/index.html" },
  { name: "GU", url: "https://www.gu-global.com/jp/" },
  { name: "UNIQLO", url: "https://www.uniqlo.com/jp/" },
  { name: "WEGO", url: "https://wego.jp/" },
  { name: "GRL", url: "https://grl.jp/" },
  { name: "LOWRYS FARM", url: "https://www.lowrys-farm.com/" },
  { name: "Heather", url: "https://heather.co.jp/" },
  { name: "INGNI", url: "https://ingni.jp/" },
  { name: "RETRO GIRL", url: "https://www.palcloset.jp/" },
  { name: "mystic", url: "https://www.mystic-official.jp/" },
  { name: "EMODA", url: "https://www.emoda.jp/" },
  { name: "MURUA", url: "https://murua.jp/" },
  { name: "SNIDEL", url: "https://snidel.com/" },
  { name: "NICE CLAUP", url: "https://www.niceclaup.jp/" },
  { name: "しまむら", url: "https://www.shimamura.co.jp/" },
];

const BEAUTY_BRANDS = [
  { name: "CANMAKE", url: "https://www.canmake.com/" },
  { name: "CEZANNE", url: "https://www.cezanne.co.jp/" },
  { name: "MAQuillAGE", url: "https://www.shiseido.co.jp/maquillage/" },
  { name: "ヒロインメイク", url: "https://www.isehan.co.jp/heroinmake/" },
  { name: "dasique", url: "https://dasique.com/" },
  { name: "peripera", url: "https://www.periperacosmetics.com/" },
  { name: "ETUDE", url: "https://www.etude.com/" },
  { name: "rom&nd", url: "https://www.romand.co.kr/" },
  { name: "fwee", url: "https://fwee.co.kr/" },
  { name: "VDL", url: "https://www.vdlcosmetic.com/" },
];

const FOOD_LINKS = [
  { url: "https://www.starbucks.co.jp/" },
  { url: "https://www.family.co.jp/" },
  { url: "https://www.goncharoff.co.jp/" },
  { url: "https://www.doutor.co.jp/" },
];

const LIFE_LINKS = [
  { url: "https://www.muji.com/jp/" },
  { url: "https://www.ikea.com/jp/ja/" },
];

const TRAVEL_LINKS = [
  { url: "https://www.jalan.net/" },
  { url: "https://www.jreast.co.jp/" },
];

const TECH_LINKS = [
  { url: "https://www.apple.com/jp/" },
  { url: "https://www.sony.jp/" },
];

const HOME_LINKS = [
  { url: "https://www.muji.com/jp/" },
  { url: "https://www.nitori-net.jp/" },
];

const FASHION_THEMES = [
  "大学生コーデ",
  "韓国系ファッション",
  "ストリート",
  "きれいめ",
  "カジュアル",
  "オフィスカジュアル",
  "デートコーデ",
  "夏コーデ",
  "バッグ",
  "スニーカー",
  "アクセサリー",
  "帽子",
  "ワンピース",
  "トップス",
  "デニム",
  "通学コーデ",
  "淡色コーデ",
  "ガーリー",
];

const BEAUTY_THEMES = [
  "リップ",
  "ファンデーション",
  "アイシャドウ",
  "チーク",
  "マスカラ",
  "アイライナー",
  "スキンケア",
  "美容液",
  "日焼け止め",
  "香水",
  "ネイル",
  "ヘアケア",
  "韓国コスメ",
  "プチプラコスメ",
  "デパコス系",
];

const FOOD_THEMES = ["カフェ", "スイーツ", "コンビニスイーツ", "抹茶", "韓国フード", "ランチ", "東京カフェ"];
const LIFE_THEMES = ["部屋", "バッグの中身", "購入品", "休日", "推し活", "大学生活"];
const TRAVEL_THEMES = ["旅行", "週末トリップ", "駅からの景色"];
const TECH_THEMES = ["ガジェット", "イヤホン", "スマホまわり"];
const HOME_THEMES = ["部屋", "デスク周り", "収納"];
const OTHER_THEMES = ["気になったもの", "今日のひとコマ"];

function videoCaption(theme: JpDemoVideoTheme, i: number) {
  const lines: Record<JpDemoVideoTheme, string[]> = {
    コーデ紹介: [
      "今日のコーデ、動画の方が雰囲気伝わる。\n動きながら撮ってみた。",
      "ルックブック風に回してみた。\n色のグラデがわかりやすいはず。",
    ],
    今日の服: [
      "今日の服、短めに撮った。\n朝はこれで十分だった。",
      "通学コーデを歩いてみた。\n靴の音まで残ってる。",
    ],
    ルックブック: [
      "ルックブック風に3パターン。\n淡色多め。",
      "休日ルックを回してみた。\nきれいめ寄り。",
    ],
    GRWM: [
      "GRWM、朝のざっくり版。\nベースとリップだけ気合入れた。",
      "出かける前のGRWM。\nメイク薄め。",
    ],
    メイク: [
      "メイク動画、ベースからざっくり。\n学校メイク寄り。",
      "涙袋だけ丁寧に塗るところ。\n短めのメイク動画。",
    ],
    コスメ購入品: [
      "コスメ購入品、開けながら。\nパケ見たい人向け。",
      "届いたものだけ動画で残す。\n写真より早い。",
    ],
    ネイル: [
      "ネイル、角度を変えながら。\nラメの入り方が好き。",
      "短いネイルの質感。\n引っかからないのが大事。",
    ],
    バッグの中身: [
      "バッグの中身、出してみた。\nポーチが主役。",
      "中身チェック動画。\n余計なものが減った。",
    ],
    カフェ: [
      "カフェの席、店内を少しだけ回した。\n写真より空気感が出る。",
      "ドリンク来るまでの待ち時間。\n光がきれいだった。",
    ],
    スイーツ: [
      "スイーツ、切るところまで。\n食感は動画の方が伝わる。",
      "断面を先に撮った。\n熱いうちに残す。",
    ],
    推し活: [
      "推し色の小物を並べただけ。\n参戦前の儀式。",
      "グッズ紹介を短く。\n雰囲気寄せの記録。",
    ],
    旅行: [
      "旅先の朝、窓からの光。\n短めの旅行メモ。",
      "駅から宿までの歩き。\n荷物は最小。",
    ],
  };
  const pool = lines[theme];
  return pool[i % pool.length]!;
}

function takeUniqueImage(
  used: Set<string>,
  pool: readonly JpImageAsset[],
  category: CategoryId,
): JpImageAsset {
  for (const asset of pool) {
    if (!used.has(asset.url)) {
      used.add(asset.url);
      return asset;
    }
  }
  throw new Error(
    `JP seed image pool exhausted for ${category} (need more unique URLs in seed-jp-images.ts)`,
  );
}

function fashionCaption(i: number, theme: string, brand: string, note: string) {
  const lines = [
    `${theme}。${note}。\n${brand}を合わせてみた。`,
    `${note}。\n大学生の${theme}として毎日使える。`,
    `${theme}に${brand}。\n${note}がちょうどいい。`,
    `通学コーデの記録。\n${note}`,
    `デートの日の${theme}。\n${note}`,
    `${brand}入りの${theme}。\n${note}`,
    `GUと${brand}で組み合わせ。\n${note}`,
    `${note}。\n色数を減らすとまとまる。`,
    `オフィスカジュアル練習。\n${note}`,
    `${theme}寄りだけどカジュアル。\n${note}`,
  ];
  return lines[i % lines.length]!;
}

function beautyCaption(i: number, theme: string, brand: string, note: string) {
  const lines = [
    `${theme}、今日は${brand}で。\n${note}`,
    `学校でも浮かないナチュラル寄り。\n${note}`,
    `${brand}の${theme}。\n${note}`,
    `ポーチの中身、今月はこれ。\n${note}`,
    `ドラッグストアで見かけて試した。\n${note}`,
    `韓国コスメを薄く落とした版。\n${note}`,
    `購入品紹介。\n${note}`,
    `今日のメイクは${theme}重視。\n${note}`,
  ];
  return lines[i % lines.length]!;
}

function foodCaption(i: number, theme: string, note: string, place?: string) {
  const where = place ?? ["渋谷", "原宿", "下北沢", "中目黒", "吉祥寺", "新大久保", "表参道", "池袋"][i % 8]!;
  const lines = [
    `${where}で見つけた${theme}。\n${note}`,
    `${theme}、今日は${where}。\n${note}`,
    `${note}。\n${where}の席が空いてて助かった。`,
    `${theme}の記録。\n${note}`,
    `${where}の${theme}。\n${note}`,
  ];
  return lines[i % lines.length]!;
}

function simpleCaption(i: number, theme: string, note: string, place?: string) {
  const placeLine = place ? `\n場所は${place}。` : "";
  const lines = [
    `${theme}の記録。\n${note}${placeLine}`,
    `${note}。\n${theme}として残しておく。${placeLine}`,
    `休日の${theme}。\n${note}${placeLine}`,
    `${theme}を更新。\n${note}${placeLine}`,
  ];
  return lines[i % lines.length]!;
}

const COMMENT_BY_CATEGORY: Record<CategoryId, string[]> = {
  fashion: [
    "このコーデ好き",
    "バッグかわいい",
    "色合わせ参考になる",
    "淡色でまとまってる",
    "スカート丈かわいい",
    "これ学校でも使えそう",
    "靴気になる",
    "プチプラ感出てていい",
    "レイヤード上手い",
    "GUっぽさ出てていい",
    "休日コーデにしたい",
    "シルエットきれい",
    "足元のバランス好き",
    "韓国っぽくていい",
    "オフィスカジュに寄せられそう",
    "アクセの選び方参考になる",
    "ワンピ可愛い",
    "デニム合わせ上手い",
    "色味落ち着いてて好き",
    "明日これ真似してみる",
  ],
  beauty: [
    "メイク薄めなの好き",
    "リップの色味知りたい",
    "肌のトーンきれい",
    "次これ試してみる",
    "ナチュラルで好き",
    "ポーチ中身見たい",
    "色味ちょうどいい",
    "涙袋の入れ方上手い",
    "ベースきれい",
    "チークの位置参考になる",
    "学校メイクに良さそう",
    "パケかわいい",
    "韓国コスメっぽい雰囲気",
    "眉毛の形好き",
    "グロスのツヤきれい",
    "スキンケア気になる",
    "ネイル色いい",
    "ヘアケアも知りたい",
  ],
  food: [
    "美味しそう",
    "これは食べたい",
    "お店どこですか？",
    "ここ気になる",
    "雰囲気いいですね",
    "今度行ってみたい",
    "カフェどこですか",
    "見た目きれい",
    "ラテアート上手い",
    "断面きれい",
    "抹茶っぽくていい",
    "新大久保行きたい",
    "ランチ候補にします",
    "席の光がいい",
    "スープの色きれい",
    "パン焼きたて感ある",
    "スイーツ保存した",
    "また行きたい雰囲気",
  ],
  travel: [
    "ここ行ったことあります",
    "景色きれい",
    "次の旅行候補にしたい",
    "写真の角度好き",
    "空気感が出てる",
    "また行きたい",
    "朝の光いい",
    "神社の雰囲気好き",
    "海きれい",
    "山の空気感じる",
    "京都っぽくていい",
    "大阪行きたい",
    "夜景きれい",
    "荷物少なそうで参考",
    "週末トリップ候補",
    "駅からの景色好き",
  ],
  home: [
    "部屋の光きれい",
    "インテリア参考になる",
    "物選びセンスいい",
    "落ち着く空間",
    "収納の仕方気になる",
    "デスク周りきれい",
    "無印っぽくていい",
    "角の整え方上手い",
    "照明の色味好き",
    "小物の置き方参考",
    "朝の部屋いい",
    "すっきりしてて好き",
  ],
  lifestyle: [
    "雰囲気好き",
    "保存した",
    "参考になる",
    "いい感じ",
    "また見に来ます",
    "休日感ある",
    "推し活っぽくていい",
    "バッグの中身気になる",
    "購入品メモ助かる",
    "大学生活の感じ好き",
    "日常の切り取り上手い",
    "色味まとまってる",
    "ゆるくていい",
    "また投稿見たい",
  ],
  tech: [
    "リンク先見ます",
    "これ気になってた",
    "レビュー助かる",
    "使い心地どうですか",
    "次これ試してみる",
    "イヤホン候補にします",
    "デスク周り参考",
    "ケースかわいい",
    "ガジェット感いい",
    "スマホまわり整理したい",
    "実機レビュー助かる",
    "値段感どうでした？",
  ],
  sports: [
    "いい感じ",
    "参考になる",
    "また見に来ます",
    "雰囲気好き",
    "動きやすそう",
    "ウェア気になる",
  ],
  other: [
    "いい感じ",
    "保存した",
    "雰囲気好き",
    "参考になる",
    "また見に来ます",
    "気になるものリスト入り",
    "今日のひとコマ好き",
    "切り取り上手い",
  ],
};

function socialLinksForDemo(n: number, slug: string, companyWebsite: string | null | undefined) {
  const pattern = n % 6;
  const handle = slug.replace(/_/g, "");
  if (pattern === 0) {
    return {
      instagramUrl: `https://www.instagram.com/${handle}/`,
      xUrl: null as string | null,
      tiktokUrl: null as string | null,
      youtubeUrl: null as string | null,
      websiteUrl: null as string | null,
    };
  }
  if (pattern === 1) {
    return {
      instagramUrl: `https://www.instagram.com/${handle}/`,
      xUrl: `https://x.com/${handle}`,
      tiktokUrl: null as string | null,
      youtubeUrl: null as string | null,
      websiteUrl: null as string | null,
    };
  }
  if (pattern === 2) {
    return {
      instagramUrl: `https://www.instagram.com/${handle}/`,
      xUrl: null as string | null,
      tiktokUrl: `https://www.tiktok.com/@${handle}`,
      youtubeUrl: null as string | null,
      websiteUrl: null as string | null,
    };
  }
  if (pattern === 3) {
    return {
      instagramUrl: null as string | null,
      xUrl: null as string | null,
      tiktokUrl: null as string | null,
      youtubeUrl: null as string | null,
      websiteUrl: companyWebsite ?? `https://example.com/${handle}`,
    };
  }
  if (pattern === 4) {
    return {
      instagramUrl: `https://www.instagram.com/${handle}/`,
      xUrl: `https://x.com/${handle}`,
      tiktokUrl: `https://www.tiktok.com/@${handle}`,
      youtubeUrl: null as string | null,
      websiteUrl: companyWebsite ?? null,
    };
  }
  return {
    instagramUrl: null as string | null,
    xUrl: null as string | null,
    tiktokUrl: null as string | null,
    youtubeUrl: null as string | null,
    websiteUrl: null as string | null,
  };
}

function buildVisibleProfiles(): Profile[] {
  return JP_PROFILES.map((def) => {
    const social = socialLinksForDemo(def.n, def.slug, def.companyWebsite);
    return {
      id: demoJpProfileId(def.n),
      username: `${DEMO_JP_USERNAME_PREFIX}${def.slug}`,
      displayName: def.displayName,
      bio: def.bio,
      avatarUrl: def.avatarUrl,
      accountType: def.accountType,
      companyName: def.companyName ?? null,
      companyWebsite: def.companyWebsite ?? null,
      companyDescription: def.companyDescription ?? null,
      ...social,
      createdAt: `2026-07-${String(1 + (def.n % 28)).padStart(2, "0")}T09:00:00.000Z`,
    };
  });
}

function buildReactors(): Profile[] {
  return Array.from({ length: 2200 }, (_, i) => {
    const n = i + 1;
    return {
      id: demoJpReactorId(n),
      username: `${DEMO_JP_USERNAME_PREFIX}r${String(n).padStart(3, "0")}`,
      displayName: `demo${n}`,
      bio: "",
      avatarUrl: null,
      accountType: "personal" as const,
      companyName: null,
      companyWebsite: null,
      companyDescription: null,
      instagramUrl: null,
      xUrl: null,
      tiktokUrl: null,
      youtubeUrl: null,
      websiteUrl: null,
      createdAt: "2026-06-01T08:00:00.000Z",
    };
  });
}

function pickCategory(def: ProfileDef, roll: number): CategoryId {
  if (def.interest === "fashion") {
    if (roll < 0.8) return "fashion";
    if (roll < 0.9) return "beauty";
    return "lifestyle";
  }
  if (def.interest === "beauty") {
    if (roll < 0.8) return "beauty";
    if (roll < 0.9) return "fashion";
    return "lifestyle";
  }
  if (def.interest === "food") {
    if (roll < 0.75) return "food";
    if (roll < 0.88) return "lifestyle";
    return "fashion";
  }
  if (def.interest === "lifestyle") {
    if (roll < 0.55) return "lifestyle";
    if (roll < 0.75) return "fashion";
    if (roll < 0.88) return "beauty";
    return "food";
  }
  if (def.interest === "travel") return roll < 0.7 ? "travel" : "lifestyle";
  if (def.interest === "tech") return roll < 0.7 ? "tech" : "other";
  if (def.interest === "home") return roll < 0.7 ? "home" : "lifestyle";
  return roll < 0.6 ? "other" : "lifestyle";
}

function buildCategoryPlan(total: number, rng: () => number): CategoryId[] {
  // Balanced mix so fashion/beauty do not dominate the JP feed.
  const quotas: Array<[CategoryId, number]> = [
    ["fashion", 80],
    ["beauty", 70],
    ["food", 80],
    ["lifestyle", 85],
    ["travel", 55],
    ["home", 40],
    ["tech", 35],
    ["other", 35],
  ];
  const sum = quotas.reduce((acc, [, n]) => acc + n, 0);
  if (sum !== total) {
    throw new Error(`JP category plan sum ${sum} !== total ${total}`);
  }
  const plan: CategoryId[] = [];
  for (const [cat, n] of quotas) {
    for (let i = 0; i < n; i += 1) plan.push(cat);
  }
  // shuffle
  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = plan[i]!;
    plan[i] = plan[j]!;
    plan[j] = tmp;
  }
  return plan;
}

function pickAuthorForCategory(
  authors: Profile[],
  defs: ProfileDef[],
  category: CategoryId,
  authorCounts: Map<string, number>,
  i: number,
) {
  const preferred = authors.filter((a) => {
    const def = defs.find((d) => demoJpProfileId(d.n) === a.id);
    return def?.interest === category;
  });
  const pool = preferred.length > 0 ? preferred : authors;
  const sorted = [...pool].sort((a, b) => {
    const ca = authorCounts.get(a.id) ?? 0;
    const cb = authorCounts.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return (a.id + i).localeCompare(b.id + String(i));
  });
  return sorted[0]!;
}

function clipsForTheme(theme: JpDemoVideoTheme) {
  const exact = JP_DEMO_VIDEO_CLIPS.filter((c) => c.theme === theme);
  return exact.length > 0 ? exact : JP_DEMO_VIDEO_CLIPS;
}

function shouldBeVideo(i: number, total: number, videoCount: number) {
  return Math.floor(((i - 1) * videoCount) / total) !== Math.floor((i * videoCount) / total);
}

function buildPosts(profiles: Profile[]): Post[] {
  assertJpImageUniqueness();
  const rng = mulberry32(20260823);
  const used = new Set<string>();
  const usedVideo = new Set<string>();
  const posts: Post[] = [];
  const authors = profiles.filter((p) => JP_PROFILES.some((d) => demoJpProfileId(d.n) === p.id));
  const total = 480;
  const videoCount = 50;
  const authorCounts = new Map<string, number>();
  const categoryPlan = buildCategoryPlan(total, rng);

  for (let i = 1; i <= total; i += 1) {
    const category = categoryPlan[i - 1]!;
    const author = pickAuthorForCategory(authors, JP_PROFILES, category, authorCounts, i);
    authorCounts.set(author.id, (authorCounts.get(author.id) ?? 0) + 1);
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === author.id)!;

    let theme: string;
    let caption: string;
    let productUrl: string | null = null;
    let productLabel: string | null = null;
    let mediaUrl: string;
    let mediaType: "photo" | "video" = "photo";
    let thumbnailUrl: string | null = null;

    const poolKey =
      category === "sports" ? "other" : (category as keyof typeof JP_IMAGES_BY_CATEGORY);
    const pool = JP_IMAGES_BY_CATEGORY[poolKey] ?? JP_IMAGES_BY_CATEGORY.other;
    const image = takeUniqueImage(used, pool, category);

    if (category === "fashion") {
      theme = image.theme || FASHION_THEMES[(i + def.n) % FASHION_THEMES.length]!;
      const brand = FASHION_BRANDS[(i + def.n) % FASHION_BRANDS.length]!;
      caption = fashionCaption(i + def.n * 3, theme, brand.name, image.note);
      mediaUrl = image.url;
      if (i % 10 < 8) {
        productUrl = brand.url;
        productLabel = "商品を見る";
      }
    } else if (category === "beauty") {
      theme = image.theme || BEAUTY_THEMES[(i + def.n) % BEAUTY_THEMES.length]!;
      const brand = BEAUTY_BRANDS[(i + def.n) % BEAUTY_BRANDS.length]!;
      caption = beautyCaption(i + def.n * 3, theme, brand.name, image.note);
      mediaUrl = image.url;
      if (i % 10 < 8) {
        productUrl = brand.url;
        productLabel = "商品を見る";
      }
    } else if (category === "food") {
      theme = image.theme || FOOD_THEMES[(i + def.n) % FOOD_THEMES.length]!;
      caption = foodCaption(i + def.n * 3, theme, image.note, image.place);
      mediaUrl = image.url;
      if (i % 10 < 6) {
        productUrl = FOOD_LINKS[i % FOOD_LINKS.length]!.url;
        productLabel = "店舗を見る";
      }
    } else if (category === "lifestyle") {
      theme = image.theme || LIFE_THEMES[(i + def.n) % LIFE_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note, image.place);
      mediaUrl = image.url;
      if (i % 10 < 5) {
        productUrl = LIFE_LINKS[i % LIFE_LINKS.length]!.url;
        productLabel = "商品を見る";
      }
    } else if (category === "travel") {
      theme = image.theme || TRAVEL_THEMES[(i + def.n) % TRAVEL_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note, image.place);
      mediaUrl = image.url;
      if (i % 10 < 5) {
        productUrl = TRAVEL_LINKS[i % TRAVEL_LINKS.length]!.url;
        productLabel = "詳細を見る";
      }
    } else if (category === "tech") {
      theme = image.theme || TECH_THEMES[(i + def.n) % TECH_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note);
      mediaUrl = image.url;
      if (i % 10 < 5) {
        productUrl = TECH_LINKS[i % TECH_LINKS.length]!.url;
        productLabel = "商品を見る";
      }
    } else if (category === "home") {
      theme = image.theme || HOME_THEMES[(i + def.n) % HOME_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note);
      mediaUrl = image.url;
      if (i % 10 < 5) {
        productUrl = HOME_LINKS[i % HOME_LINKS.length]!.url;
        productLabel = "商品を見る";
      }
    } else {
      theme = image.theme || OTHER_THEMES[(i + def.n) % OTHER_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note);
      mediaUrl = image.url;
    }

    if (shouldBeVideo(i, total, videoCount)) {
      const videoThemePool: JpDemoVideoTheme[] =
        category === "fashion"
          ? ["コーデ紹介", "今日の服", "ルックブック", "推し活"]
          : category === "beauty"
            ? ["メイク", "GRWM", "コスメ購入品", "ネイル"]
            : category === "food"
              ? ["カフェ", "スイーツ"]
              : category === "travel"
                ? ["旅行"]
                : ["バッグの中身", "推し活", "旅行", "ネイル"];
      const videoTheme = videoThemePool[(i + def.n) % videoThemePool.length]!;
      const clips = clipsForTheme(videoTheme);
      // Prefer unused video URLs so clips are not hammered.
      let clip = clips.find((c) => !usedVideo.has(c.url)) ?? clips[(i + def.n) % clips.length]!;
      usedVideo.add(clip.url);
      caption = videoCaption(clip.theme, i + def.n);
      thumbnailUrl = mediaUrl;
      mediaUrl = clip.url;
      mediaType = "video";
      if (!clip.hasAudio) {
        throw new Error(`JP demo video missing audio flag: ${clip.url}`);
      }
    }

    const isSponsored = i % 11 === 0;
    const isBrandbridge = i % 16 === 0 || (author.accountType === "business" && i % 10 === 0);
    if (isBrandbridge) {
      productUrl = "https://www.brandbridge.jp";
      productLabel = "商品を見る";
    }

    const createdAt = new Date(
      Date.parse("2026-08-28T18:00:00.000Z") + i * 2 * 60 * 1000,
    ).toISOString();

    posts.push({
      id: demoJpPostId(i),
      authorId: author.id,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      caption,
      category,
      productUrl,
      productLabel,
      isSponsored,
      source: isBrandbridge ? "brandbridge" : "user",
      sourceRef: isBrandbridge ? `bb-jp-${String(i).padStart(3, "0")}` : null,
      sourceUrl: isBrandbridge ? "https://www.brandbridge.jp" : null,
      createdAt,
    });
  }

  return posts;
}

type FollowTier = "normal" | "rising" | "popular";

function followTierFor(def: ProfileDef): FollowTier {
  if (def.accountType === "business") {
    // Brand accounts skew rising/popular.
    return def.n % 3 === 0 ? "popular" : "rising";
  }
  // Early personal accounts act as slightly better-known creators.
  if (def.n <= 4) return "popular";
  if (def.n <= 18) return "rising";
  if (def.n <= 36) return def.n % 4 === 0 ? "rising" : "normal";
  return "normal";
}

function targetFollowerCount(rng: () => number, tier: FollowTier) {
  if (tier === "popular") return pickCount(rng, 500, 2000);
  if (tier === "rising") return pickCount(rng, 100, 500);
  return pickCount(rng, 8, 80);
}

function targetFollowingCount(
  rng: () => number,
  tier: FollowTier,
  followers: number,
) {
  if (tier === "popular") {
    const max = Math.min(800, Math.max(120, Math.floor(followers * 0.55) + 80));
    return pickCount(rng, 100, max);
  }
  if (tier === "rising") {
    const max = Math.min(300, Math.max(80, Math.floor(followers * 0.85) + 40));
    return pickCount(rng, 50, max);
  }
  return pickCount(rng, 10, 100);
}

function shuffleInPlace<T>(items: T[], rng: () => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function buildFollows(
  visible: Profile[],
  reactors: Profile[],
): Array<{ followerId: string; followeeId: string }> {
  const rng = mulberry32(271828);
  const follows: Array<{ followerId: string; followeeId: string }> = [];
  const seen = new Set<string>();

  function add(followerId: string, followeeId: string) {
    if (followerId === followeeId) return false;
    const key = `${followerId}:${followeeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    follows.push({ followerId, followeeId });
    return true;
  }

  const plans = visible.map((profile) => {
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === profile.id)!;
    const tier = followTierFor(def);
    const followers = targetFollowerCount(rng, tier);
    const following = targetFollowingCount(rng, tier, followers);
    return { profile, def, tier, followers, following };
  });

  // 1) Outgoing follows (following count) — visibles + reactors as followees.
  for (const plan of plans) {
    const candidates = shuffleInPlace(
      [
        ...visible.filter((p) => p.id !== plan.profile.id),
        ...reactors,
      ],
      rng,
    );
    let added = 0;
    for (const candidate of candidates) {
      if (added >= plan.following) break;
      if (add(plan.profile.id, candidate.id)) added += 1;
    }
  }

  // 2) Incoming follows (follower count) — top up mostly from reactors.
  for (const plan of plans) {
    const current = follows.reduce(
      (acc, row) => (row.followeeId === plan.profile.id ? acc + 1 : acc),
      0,
    );
    const need = plan.followers - current;
    if (need <= 0) continue;

    const candidates = shuffleInPlace(
      [
        ...reactors,
        ...visible.filter((p) => p.id !== plan.profile.id),
      ],
      rng,
    );
    let added = 0;
    for (const candidate of candidates) {
      if (added >= need) break;
      if (add(candidate.id, plan.profile.id)) added += 1;
    }
  }

  return follows;
}

type ReactionTier = "low" | "mid" | "hot" | "mega";

function reactionTierFor(
  post: Post,
  index: number,
  authorTier: FollowTier,
): ReactionTier {
  const hotCat = post.category === "fashion" || post.category === "beauty" || post.category === "food";
  // Popular authors skew warmer, but not every post is mega/hot.
  if (authorTier === "popular") {
    if (index % 13 === 0) return "mega";
    if (index % 5 === 0 || (hotCat && index % 4 === 0)) return "hot";
    return "mid";
  }
  if (authorTier === "rising") {
    if (hotCat && index % 23 === 0) return "mega";
    if (index % 7 === 0 || (hotCat && index % 6 === 0)) return "hot";
    if (index % 4 === 0) return "mid";
    return "low";
  }
  if (hotCat && index % 29 === 0) return "hot";
  if (index % 5 === 0) return "mid";
  return "low";
}

function buildReactions(visible: Profile[], reactors: Profile[], posts: Post[]) {
  const rng = mulberry32(314159);
  const pool = [...visible, ...reactors];
  const likes: Array<{ userId: string; postId: string }> = [];
  const wants: Array<{ userId: string; postId: string }> = [];
  const saves: Array<{ userId: string; postId: string }> = [];
  const comments: Comment[] = [];
  let commentN = 1;
  const authorTier = new Map<string, FollowTier>();
  for (const profile of visible) {
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === profile.id);
    if (def) authorTier.set(profile.id, followTierFor(def));
  }

  for (const [index, post] of posts.entries()) {
    const aTier = authorTier.get(post.authorId) ?? "normal";
    const tier = reactionTierFor(post, index + 1, aTier);
    const likeTarget =
      tier === "mega"
        ? pickCount(rng, 300, 1000)
        : tier === "hot"
          ? pickCount(rng, 80, 300)
          : tier === "mid"
            ? pickCount(rng, 20, 100)
            : pickCount(rng, 3, 30);
    // Popular posts get more saves/wants; normal posts stay sparse.
    const wantTarget =
      tier === "mega"
        ? Math.floor(likeTarget * 0.22)
        : tier === "hot"
          ? Math.floor(likeTarget * 0.18)
          : tier === "mid"
            ? Math.floor(likeTarget * 0.12)
            : pickCount(rng, 0, Math.max(1, Math.floor(likeTarget * 0.08)));
    const saveTarget =
      tier === "mega"
        ? Math.floor(likeTarget * 0.2)
        : tier === "hot"
          ? Math.floor(likeTarget * 0.15)
          : tier === "mid"
            ? Math.floor(likeTarget * 0.1)
            : pickCount(rng, 0, Math.max(1, Math.floor(likeTarget * 0.07)));
    const commentTarget =
      tier === "mega"
        ? pickCount(rng, 4, 10)
        : tier === "hot"
          ? pickCount(rng, 2, 8)
          : tier === "mid"
            ? pickCount(rng, 0, 3)
            : rng() < 0.55
              ? 0
              : pickCount(rng, 0, 2);

    const shuffled = shuffleInPlace(
      pool.filter((p) => p.id !== post.authorId),
      rng,
    );
    const liked = new Set<string>();
    for (let n = 0; n < likeTarget && n < shuffled.length; n += 1) {
      const userId = shuffled[n]!.id;
      if (liked.has(userId)) continue;
      liked.add(userId);
      likes.push({ userId, postId: post.id });
    }
    const wanted = new Set<string>();
    for (let n = 0; n < wantTarget && n < shuffled.length; n += 1) {
      const userId = shuffled[(n + 11) % shuffled.length]!.id;
      if (wanted.has(userId) || userId === post.authorId) continue;
      wanted.add(userId);
      wants.push({ userId, postId: post.id });
    }
    const saved = new Set<string>();
    for (let n = 0; n < saveTarget && n < shuffled.length; n += 1) {
      const userId = shuffled[(n + 29) % shuffled.length]!.id;
      if (saved.has(userId) || userId === post.authorId) continue;
      saved.add(userId);
      saves.push({ userId, postId: post.id });
    }

    const commentLines =
      COMMENT_BY_CATEGORY[post.category] ?? COMMENT_BY_CATEGORY.other;
    const usedBodies = new Set<string>();
    for (let n = 0; n < commentTarget && n < shuffled.length; n += 1) {
      const user = shuffled[(n + 47) % shuffled.length]!;
      // Prefer unused lines on the same post to avoid identical spam.
      let body = commentLines[(commentN * 7 + n * 3 + index) % commentLines.length]!;
      if (usedBodies.has(body)) {
        const alt = commentLines.find((line) => !usedBodies.has(line));
        if (alt) body = alt;
      }
      usedBodies.add(body);
      comments.push({
        id: demoJpCommentId(commentN),
        userId: user.id,
        postId: post.id,
        body,
        createdAt: post.createdAt,
      });
      commentN += 1;
    }
  }

  return { likes, wants, saves, comments };
}

export const SEED_JP_PROFILES: Profile[] = buildVisibleProfiles();
export const SEED_JP_REACTORS: Profile[] = buildReactors();
export const SEED_JP_AUTH_PROFILES: Profile[] = [...SEED_JP_PROFILES, ...SEED_JP_REACTORS];
export const SEED_JP_POSTS: Post[] = buildPosts(SEED_JP_PROFILES);
const jpReactions = buildReactions(SEED_JP_PROFILES, SEED_JP_REACTORS, SEED_JP_POSTS);
export const SEED_JP_FOLLOWS = buildFollows(SEED_JP_PROFILES, SEED_JP_REACTORS);
export const SEED_JP_LIKES = jpReactions.likes;
export const SEED_JP_WANTS = jpReactions.wants;
export const SEED_JP_SAVES = jpReactions.saves;
export const SEED_JP_COMMENTS: Comment[] = jpReactions.comments;

export function jpSeedStats() {
  const categories = SEED_JP_POSTS.reduce<Record<string, number>>((acc, post) => {
    acc[post.category] = (acc[post.category] ?? 0) + 1;
    return acc;
  }, {});
  const videos = SEED_JP_POSTS.filter((p) => p.mediaType === "video");
  const photos = SEED_JP_POSTS.filter((p) => p.mediaType === "photo");
  const photoUrls = photos.map((p) => p.mediaUrl);
  const thumbUrls = videos.map((p) => p.thumbnailUrl).filter(Boolean) as string[];
  const allStillUrls = [...photoUrls, ...thumbUrls];
  const audioVideos = videos.filter((p) =>
    JP_DEMO_VIDEO_CLIPS.some((c) => c.url === p.mediaUrl && c.hasAudio),
  );
  const authorIds = new Set(SEED_JP_POSTS.map((p) => p.authorId));
  const followerCounts: number[] = [];
  const followingCounts: number[] = [];
  for (const profile of SEED_JP_PROFILES) {
    followerCounts.push(
      SEED_JP_FOLLOWS.filter((f) => f.followeeId === profile.id).length,
    );
    followingCounts.push(
      SEED_JP_FOLLOWS.filter((f) => f.followerId === profile.id).length,
    );
  }
  followerCounts.sort((a, b) => a - b);
  followingCounts.sort((a, b) => a - b);
  const likeByPost = SEED_JP_POSTS.map(
    (post) => SEED_JP_LIKES.filter((l) => l.postId === post.id).length,
  ).sort((a, b) => a - b);
  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  const snsUsers = SEED_JP_PROFILES.filter(
    (p) => p.instagramUrl || p.xUrl || p.tiktokUrl || p.youtubeUrl || p.websiteUrl,
  ).length;
  const selfFollows = SEED_JP_FOLLOWS.filter((f) => f.followerId === f.followeeId).length;
  const followKeys = new Set(SEED_JP_FOLLOWS.map((f) => `${f.followerId}:${f.followeeId}`));
  const selfLikes = SEED_JP_LIKES.filter((l) => {
    const post = SEED_JP_POSTS.find((p) => p.id === l.postId);
    return post && post.authorId === l.userId;
  }).length;
  const uniqueCommentBodies = new Set(SEED_JP_COMMENTS.map((c) => c.body)).size;
  const postsWithComments = new Set(SEED_JP_COMMENTS.map((c) => c.postId)).size;
  return {
    profiles: SEED_JP_PROFILES.length,
    reactors: SEED_JP_REACTORS.length,
    posts: SEED_JP_POSTS.length,
    follows: SEED_JP_FOLLOWS.length,
    likes: SEED_JP_LIKES.length,
    wants: SEED_JP_WANTS.length,
    saves: SEED_JP_SAVES.length,
    comments: SEED_JP_COMMENTS.length,
    uniqueCommentBodies,
    postsWithComments,
    snsUsers,
    selfFollows,
    duplicateFollows: SEED_JP_FOLLOWS.length - followKeys.size,
    selfLikes,
    productUrl: SEED_JP_POSTS.filter((p) => p.productUrl).length,
    sponsored: SEED_JP_POSTS.filter((p) => p.isSponsored).length,
    brandbridge: SEED_JP_POSTS.filter((p) => p.source === "brandbridge").length,
    videos: videos.length,
    videoWithThumb: videos.filter((p) => Boolean(p.thumbnailUrl)).length,
    audioVideos: audioVideos.length,
    uniquePhotoUrls: new Set(photoUrls).size,
    uniqueStillUrls: new Set(allStillUrls).size,
    stillUrlReuse: allStillUrls.length - new Set(allStillUrls).size,
    uniqueVideoUrls: new Set(videos.map((p) => p.mediaUrl)).size,
    fashion: categories.fashion ?? 0,
    beauty: categories.beauty ?? 0,
    food: categories.food ?? 0,
    distinctAuthors: authorIds.size,
    categories,
    followFollowers: {
      min: followerCounts[0] ?? 0,
      p50: followerCounts[Math.floor(followerCounts.length / 2)] ?? 0,
      max: followerCounts[followerCounts.length - 1] ?? 0,
      avg: avg(followerCounts),
    },
    followFollowing: {
      min: followingCounts[0] ?? 0,
      p50: followingCounts[Math.floor(followingCounts.length / 2)] ?? 0,
      max: followingCounts[followingCounts.length - 1] ?? 0,
      avg: avg(followingCounts),
    },
    likesPerPost: {
      min: likeByPost[0] ?? 0,
      p50: likeByPost[Math.floor(likeByPost.length / 2)] ?? 0,
      max: likeByPost[likeByPost.length - 1] ?? 0,
      avg: avg(likeByPost),
    },
  };
}
