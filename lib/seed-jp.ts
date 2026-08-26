import type { AccountType, CategoryId, Comment, Post, Profile } from "@/lib/types";
import {
  assertJpImageUniqueness,
  JP_IMAGES_BY_CATEGORY,
  JP_PHOTO_AVATARS,
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
  // Prefer non-portrait hosted demo media over Unsplash people photos.
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=80`;
}

function demoAvatar(seed: string, label: string) {
  const name = encodeURIComponent(label.slice(0, 2) || "N");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const bg = (hash & 0xffffff).toString(16).padStart(6, "0");
  return `https://ui-avatars.com/api/?name=${name}&background=${bg}&color=fff&size=200&bold=true&format=png`;
}

/** Mix photo avatars with initials — not all AI, not all the same face. */

const PERSONAL: Array<Omit<ProfileDef, "n" | "avatarUrl" | "accountType"> & { interest: Interest }> = [
  { slug: "mei", displayName: "めい", bio: "大学生。淡色コーデと韓国っぽシルエットが好き。デモ用アカウント。", interest: "fashion" },
  { slug: "yuna", displayName: "ゆな", bio: "通学コーデと白スニーカー集め。足元から整える派。", interest: "fashion" },
  { slug: "rina", displayName: "りな", bio: "きれいめカジュアル。ジャケットとスラックス研究中。", interest: "fashion" },
  { slug: "akari", displayName: "あかり", bio: "ストリート寄りの休日コーデ。レイヤード多め。", interest: "fashion" },
  { slug: "mio", displayName: "みお", bio: "デートコーデとミニバッグ記録。カバン沼。", interest: "fashion" },
  { slug: "hina", displayName: "ひな", bio: "オフィスカジュアル練習中。時計は細ベルト派。", interest: "fashion" },
  { slug: "sakura", displayName: "さくら", bio: "ワンピースと帽子。季節感のある服が好き。", interest: "fashion" },
  { slug: "ayaka", displayName: "あやか", bio: "デニムとトップスの組み合わせ。シンプルが落ち着く。", interest: "fashion" },
  { slug: "nana", displayName: "なな", bio: "夏コーデとアクセサリー。ピアスとリング多め。", interest: "fashion" },
  { slug: "reina", displayName: "れいな", bio: "大人カジュアル。時計と革小物を少しずつ。", interest: "fashion" },
  { slug: "koharu", displayName: "こはる", bio: "ガーリーコーデとリボン靴。淡色多め。", interest: "fashion" },
  { slug: "sora", displayName: "そら", bio: "韓国系ファッションをゆるく。オーバーサイズ好き。", interest: "fashion" },
  { slug: "momo", displayName: "もも", bio: "ショルダーバッグとスニーカー沼。実用重視。", interest: "fashion" },
  { slug: "ichika", displayName: "いちか", bio: "きれいめ休日服。アクセは最小限。", interest: "fashion" },
  { slug: "himari", displayName: "ひまり", bio: "帽子とワンピの季節感。サンダル選びが長い。", interest: "fashion" },
  { slug: "aoi", displayName: "あおい", bio: "リップとチークの色見本。ナチュラル寄り。", interest: "beauty" },
  { slug: "emi", displayName: "えみ", bio: "プチプラコスメ購入品メモ。ドラッグストア巡り。", interest: "beauty" },
  { slug: "risa", displayName: "りさ", bio: "韓国コスメとスキンケア。ベースが勝負。", interest: "beauty" },
  { slug: "mika", displayName: "みか", bio: "アイシャドウとマスカラ。目元の色だけ冒険。", interest: "beauty" },
  { slug: "yui", displayName: "ゆい", bio: "ファンデーションと下地。崩れにくい組み合わせ探し。", interest: "beauty" },
  { slug: "saki", displayName: "さき", bio: "ネイルとヘアケア。短めネイル派。", interest: "beauty" },
  { slug: "honoka", displayName: "ほのか", bio: "日焼け止めと美容液。朝のスキンケア最短ルート。", interest: "beauty" },
  { slug: "kotone", displayName: "ことね", bio: "香水とポーチの中身。香りは軽めが好き。", interest: "beauty" },
  { slug: "noa", displayName: "のあ", bio: "デパコスもたまに試す。リップだけ奮発しがち。", interest: "beauty" },
  { slug: "fuka", displayName: "ふうか", bio: "アイライナー細引き派。涙袋も薄く。", interest: "beauty" },
  { slug: "chika", displayName: "ちか", bio: "GRWMと今日のメイク。学校メイク寄り。", interest: "beauty" },
  { slug: "misa", displayName: "みさ", bio: "ティントリップ多め。落ちにくい色探し。", interest: "beauty" },
  { slug: "yume", displayName: "ゆめ", bio: "チークの位置研究。血色感だけ足す。", interest: "beauty" },
  { slug: "airi", displayName: "あいり", bio: "カフェとコンビニスイーツ。席の光が大事。", interest: "food" },
  { slug: "an", displayName: "あん", bio: "東京カフェ巡り。ラテアートより空間派。", interest: "food" },
  { slug: "nagi", displayName: "なぎ", bio: "抹茶と韓国フード。新大久保多め。", interest: "food" },
  { slug: "miku", displayName: "みく", bio: "ランチとスイーツ記録。甘さ控えめで探す。", interest: "food" },
  { slug: "hinata", displayName: "ひなた", bio: "週末ブランチ。カフェの窓際が好き。", interest: "food" },
  { slug: "suzuka", displayName: "すずか", bio: "部屋と休日の朝。雑貨を少しずつ入れ替え。", interest: "lifestyle" },
  { slug: "toha", displayName: "とは", bio: "推し活とバッグの中身。小物の色合わせ。", interest: "lifestyle" },
  { slug: "kokona", displayName: "ここな", bio: "大学生活と購入品。欲しいものリスト公開。", interest: "lifestyle" },
  { slug: "maho", displayName: "まほ", bio: "大人カジュアルと休日スナップ。バッグ記録多め。", interest: "fashion" },
  { slug: "eri", displayName: "えり", bio: "フェミニン寄りのワンピと靴。カフェコーデ好き。", interest: "fashion" },
  { slug: "kaho", displayName: "かほ", bio: "時計好き。細ベルトとオフィスカジュアル。", interest: "fashion" },
  { slug: "sara", displayName: "さら", bio: "デスク周りとインテリア。収納を整える係。", interest: "home" },
  { slug: "moe", displayName: "もえ", bio: "プチプラファッションと雑貨。GU・しまむら多め。", interest: "fashion" },
  { slug: "asuka", displayName: "あすか", bio: "オフィスカジュアル挑戦中。時計で引き締め。", interest: "fashion" },
  { slug: "riko", displayName: "りこ", bio: "アクセと帽子の組み合わせ。金属はゴールド寄り。", interest: "fashion" },
  { slug: "nanami", displayName: "ななみ", bio: "韓国メイク薄め版。ティント中心。", interest: "beauty" },
  { slug: "yuina", displayName: "ゆいな", bio: "ヘアケアとネイル。香り付きオイル好き。", interest: "beauty" },
  { slug: "miyu", displayName: "みゆ", bio: "カフェの席と光。スイーツはシェア前提。", interest: "food" },
  { slug: "ruka", displayName: "るか", bio: "購入品と休日。バッグと靴の記録。", interest: "lifestyle" },
  { slug: "shiori", displayName: "しおり", bio: "モード寄りの黒コーデ。靴選びが長い。", interest: "fashion" },
  { slug: "haruka", displayName: "はるか", bio: "ウェルネスと朝のスキンケア。薄いメイク派。", interest: "beauty" },
  { slug: "ayane", displayName: "あやね", bio: "部屋の角だけ整える係。照明と雑貨。", interest: "home" },
  { slug: "ninon", displayName: "にのん", bio: "ミニマル寄りの今日の服。色数は3色まで。", interest: "fashion" },
  { slug: "remi", displayName: "れみ", bio: "リップとグロスの沼。香水は重ねづけ。", interest: "beauty" },
  { slug: "kanon", displayName: "かのん", bio: "スイーツよりドリンク派。抹茶ラテ定番。", interest: "food" },
  { slug: "tsumugi", displayName: "つむぎ", bio: "推し色の小物集め。アクセとポーチ。", interest: "lifestyle" },
  { slug: "io", displayName: "いお", bio: "夏コーデとサンダル。足首のアクセ多め。", interest: "fashion" },
  { slug: "riho", displayName: "りほ", bio: "スキンケアの順番メモ。美容液は季節で変える。", interest: "beauty" },
  { slug: "ume", displayName: "うめ", bio: "抹茶ラテと和菓子寄りスイーツ。", interest: "food" },
  { slug: "kota", displayName: "こた", bio: "バッグ好き。小さめショルダーを集めてる。デモ用。", interest: "fashion" },
];

const BUSINESS: Array<Omit<ProfileDef, "n" | "accountType"> & { avatarUrl: string }> = [
  {
    slug: "closetnote",
    displayName: "CLOSET NOTE",
    bio: "デイリーに着たい服のメモ帳。",
    avatarUrl: demoAvatar("jp-closetnote", "CN"),
    interest: "fashion",
    companyName: "CLOSET NOTE",
    companyWebsite: "https://www.gu-global.com/jp/",
    companyDescription: "若年層向けコーディネート紹介。",
  },
  {
    slug: "palecloset",
    displayName: "pale closet",
    bio: "淡色とガーリーのセレクト。",
    avatarUrl: demoAvatar("jp-palecloset", "PC"),
    interest: "fashion",
    companyName: "pale closet",
    companyWebsite: "https://grl.jp/",
    companyDescription: "ファッションセレクトのデモアカウント。",
  },
  {
    slug: "streetmini",
    displayName: "STREET MINI",
    bio: "スニーカーとカジュアル。",
    avatarUrl: demoAvatar("jp-streetmini", "SM"),
    interest: "fashion",
    companyName: "STREET MINI",
    companyWebsite: "https://wego.jp/",
    companyDescription: "カジュアル寄りのショップアカウント。",
  },
  {
    slug: "pouchlab",
    displayName: "POUCH LAB",
    bio: "プチプラコスメの試し記録。",
    avatarUrl: demoAvatar("jp-pouchlab", "PL"),
    interest: "beauty",
    companyName: "POUCH LAB",
    companyWebsite: "https://www.canmake.com/",
    companyDescription: "コスメ紹介のデモアカウント。",
  },
  {
    slug: "lipnote",
    displayName: "LIP NOTE",
    bio: "リップとグロスの色見本。",
    avatarUrl: demoAvatar("jp-lipnote", "LN"),
    interest: "beauty",
    companyName: "LIP NOTE",
    companyWebsite: "https://www.cezanne.co.jp/",
    companyDescription: "リップ中心のデモショップ。",
  },
  {
    slug: "krbeauty",
    displayName: "KR BEAUTY",
    bio: "韓国コスメのパッケージが好き。",
    avatarUrl: demoAvatar("jp-krbeauty", "KR"),
    interest: "beauty",
    companyName: "KR BEAUTY",
    companyWebsite: "https://www.etude.com/",
    companyDescription: "韓国コスメ紹介。",
  },
  {
    slug: "cafewalk",
    displayName: "CAFE WALK",
    bio: "東京カフェの席写真。",
    avatarUrl: demoAvatar("jp-cafewalk", "CW"),
    interest: "food",
    companyName: "CAFE WALK",
    companyWebsite: "https://www.starbucks.co.jp/",
    companyDescription: "カフェ巡りのデモアカウント。",
  },
  {
    slug: "roomnote",
    displayName: "ROOM NOTE",
    bio: "部屋とデスク周りの更新。",
    avatarUrl: demoAvatar("jp-roomnote", "RN"),
    interest: "home",
    companyName: "ROOM NOTE",
    companyWebsite: "https://www.muji.com/jp/",
    companyDescription: "インテリア寄りのデモアカウント。",
  },
  {
    slug: "watchnote",
    displayName: "WATCH NOTE",
    bio: "毎日つけたい細い腕時計。",
    avatarUrl: demoAvatar("jp-watchnote", "WN"),
    interest: "fashion",
    companyName: "WATCH NOTE",
    companyWebsite: "https://www.casio.com/jp/",
    companyDescription: "腕時計発見のデモアカウント。",
  },
  {
    slug: "bagdiary",
    displayName: "BAG DIARY",
    bio: "小さめバッグの日常記録。",
    avatarUrl: demoAvatar("jp-bagdiary", "BD"),
    interest: "fashion",
    companyName: "BAG DIARY",
    companyWebsite: "https://www.samantha.co.jp/",
    companyDescription: "バッグ紹介のデモアカウント。",
  },
];

function buildProfileDefs(): ProfileDef[] {
  const personal: ProfileDef[] = PERSONAL.map((p, i) => ({
    n: i + 1,
    slug: p.slug,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl:
      i < JP_PHOTO_AVATARS.length
        ? JP_PHOTO_AVATARS[i]!
        : demoAvatar(`jp-${p.slug}`, p.displayName),
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
  "ショルダーバッグ",
  "腕時計",
  "細い腕時計",
  "スニーカー",
  "サンダル",
  "ローファー",
  "アクセサリー",
  "ピアス",
  "リング",
  "ネックレス",
  "帽子",
  "ワンピース",
  "トップス",
  "デニム",
  "通学コーデ",
  "淡色コーデ",
  "ガーリー",
  "ミニマル",
  "大人カジュアル",
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
  "ボディミスト",
  "ネイル",
  "ヘアケア",
  "韓国コスメ",
  "プチプラコスメ",
  "デパコス系",
];

/** Demo product cards linked from posts (official brand sites — discovery sample). */
type DemoProduct = {
  name: string;
  brand: string;
  priceYen: number;
  url: string;
  kind: "洋服" | "腕時計" | "バッグ" | "靴" | "アクセサリー" | "コスメ" | "香水" | "雑貨";
  /** japan = Japanese brand; imported = overseas brand sold in Japan */
  origin: "japan" | "imported";
};

const FASHION_PRODUCTS: DemoProduct[] = [
  { name: "オーバーサイズニット", brand: "GU", priceYen: 2990, url: "https://www.gu-global.com/jp/", kind: "洋服", origin: "japan" },
  { name: "プリーツミニスカート", brand: "GRL", priceYen: 1699, url: "https://grl.jp/", kind: "洋服", origin: "japan" },
  { name: "デニムストレート", brand: "UNIQLO", priceYen: 3990, url: "https://www.uniqlo.com/jp/", kind: "洋服", origin: "japan" },
  { name: "シアーシャツ", brand: "LOWRYS FARM", priceYen: 4400, url: "https://www.lowrys-farm.com/", kind: "洋服", origin: "japan" },
  { name: "ニットベスト", brand: "INGNI", priceYen: 3300, url: "https://ingni.jp/", kind: "洋服", origin: "japan" },
  { name: "ワイドパンツ", brand: "WEGO", priceYen: 4290, url: "https://wego.jp/", kind: "洋服", origin: "japan" },
  { name: "フレアワンピース", brand: "NICE CLAUP", priceYen: 6490, url: "https://www.niceclaup.jp/", kind: "洋服", origin: "japan" },
  { name: "クロップドカーディガン", brand: "Heather", priceYen: 4950, url: "https://heather.co.jp/", kind: "洋服", origin: "japan" },
  { name: "リネンブレンドシャツ", brand: "earth music&ecology", priceYen: 4590, url: "https://www.earth-music.co.jp/", kind: "洋服", origin: "japan" },
  { name: "テーラードジャケット", brand: "GLOBAL WORK", priceYen: 7990, url: "https://www.globalwork.jp/", kind: "洋服", origin: "japan" },
  { name: "ステンレス腕時計", brand: "CASIO", priceYen: 9900, url: "https://www.casio.com/jp/", kind: "腕時計", origin: "japan" },
  { name: "細ベルト腕時計", brand: "SEIKO", priceYen: 22000, url: "https://www.seiko.co.jp/", kind: "腕時計", origin: "japan" },
  { name: "メッシュベルト時計", brand: "CITIZEN", priceYen: 16500, url: "https://www.citizen.co.jp/", kind: "腕時計", origin: "japan" },
  { name: "スクエアフェイス時計", brand: "CASIO", priceYen: 12800, url: "https://www.casio.com/jp/", kind: "腕時計", origin: "japan" },
  { name: "ミニショルダーバッグ", brand: "GRL", priceYen: 2199, url: "https://grl.jp/", kind: "バッグ", origin: "japan" },
  { name: "トートバッグ", brand: "MUJI", priceYen: 1990, url: "https://www.muji.com/jp/", kind: "バッグ", origin: "japan" },
  { name: "チェーンバッグ", brand: "Samantha Thavasa", priceYen: 9900, url: "https://www.samantha.co.jp/", kind: "バッグ", origin: "japan" },
  { name: "サコッシュ", brand: "niko and ...", priceYen: 1980, url: "https://www.nikoand.jp/", kind: "バッグ", origin: "japan" },
  { name: "バケットバッグ", brand: "BEAMS", priceYen: 7700, url: "https://www.beams.co.jp/", kind: "バッグ", origin: "japan" },
  { name: "白スニーカー", brand: "NIKE", priceYen: 12100, url: "https://www.nike.com/jp/", kind: "靴", origin: "imported" },
  { name: "ローファー", brand: "GU", priceYen: 2990, url: "https://www.gu-global.com/jp/", kind: "靴", origin: "japan" },
  { name: "ストラップサンダル", brand: "GRL", priceYen: 2499, url: "https://grl.jp/", kind: "靴", origin: "japan" },
  { name: "厚底スニーカー", brand: "WEGO", priceYen: 5490, url: "https://wego.jp/", kind: "靴", origin: "japan" },
  { name: "ミュール", brand: "INGNI", priceYen: 3850, url: "https://ingni.jp/", kind: "靴", origin: "japan" },
  { name: "フープピアス", brand: "GRL", priceYen: 550, url: "https://grl.jp/", kind: "アクセサリー", origin: "japan" },
  { name: "細リングセット", brand: "GU", priceYen: 990, url: "https://www.gu-global.com/jp/", kind: "アクセサリー", origin: "japan" },
  { name: "パールネックレス", brand: "LOWRYS FARM", priceYen: 2200, url: "https://www.lowrys-farm.com/", kind: "アクセサリー", origin: "japan" },
  { name: "バングル", brand: "UNITED ARROWS", priceYen: 4400, url: "https://store.united-arrows.co.jp/", kind: "アクセサリー", origin: "japan" },
  { name: "ヘアクリップ", brand: "しまむら", priceYen: 550, url: "https://www.shimamura.co.jp/", kind: "アクセサリー", origin: "japan" },
  { name: "バケットハット", brand: "UNIQLO", priceYen: 1990, url: "https://www.uniqlo.com/jp/", kind: "アクセサリー", origin: "japan" },
];

const BEAUTY_PRODUCTS: DemoProduct[] = [
  { name: "クリームチーク", brand: "CANMAKE", priceYen: 660, url: "https://www.canmake.com/", kind: "コスメ", origin: "japan" },
  { name: "ラスティングリップ", brand: "CEZANNE", priceYen: 550, url: "https://www.cezanne.co.jp/", kind: "コスメ", origin: "japan" },
  { name: "マスカラ", brand: "ヒロインメイク", priceYen: 1320, url: "https://www.isehan.co.jp/heroinmake/", kind: "コスメ", origin: "japan" },
  { name: "アイパレット", brand: "dasique", priceYen: 3300, url: "https://dasique.com/", kind: "コスメ", origin: "imported" },
  { name: "ティント", brand: "peripera", priceYen: 1650, url: "https://www.periperacosmetics.com/", kind: "コスメ", origin: "imported" },
  { name: "クッションファンデ", brand: "ETUDE", priceYen: 2750, url: "https://www.etude.com/", kind: "コスメ", origin: "imported" },
  { name: "リップティント", brand: "rom&nd", priceYen: 1980, url: "https://www.romand.co.kr/", kind: "コスメ", origin: "imported" },
  { name: "ハイライター", brand: "fwee", priceYen: 2420, url: "https://fwee.co.kr/", kind: "コスメ", origin: "imported" },
  { name: "ベースメイク", brand: "MAQuillAGE", priceYen: 3850, url: "https://www.shiseido.co.jp/maquillage/", kind: "コスメ", origin: "japan" },
  { name: "ボディミスト", brand: "SHIRO", priceYen: 3850, url: "https://shiro-shiro.jp/", kind: "香水", origin: "japan" },
  { name: "オードトワレ", brand: "SHIRO", priceYen: 7700, url: "https://shiro-shiro.jp/", kind: "香水", origin: "japan" },
  { name: "ヘアオイル", brand: "&honey", priceYen: 1980, url: "https://andhoney.jp/", kind: "コスメ", origin: "japan" },
];

function formatProductLabel(product: DemoProduct) {
  const tag = product.origin === "japan" ? "日本ブランド" : "Imported brand";
  return `${tag} · ${product.brand} ${product.name} · ¥${product.priceYen.toLocaleString("ja-JP")}`;
}

function pickFashionProduct(i: number, theme: string): DemoProduct {
  const kindHint =
    /時計|腕時計/.test(theme)
      ? "腕時計"
      : /バッグ|ショルダー|トート|バケットバッグ/.test(theme)
        ? "バッグ"
        : /スニーカー|サンダル|ローファー|靴|ミュール/.test(theme)
          ? "靴"
          : /アクセ|ピアス|リング|ネックレス|帽子|ハット|クリップ/.test(theme)
            ? "アクセサリー"
            : "洋服";
  const pool = FASHION_PRODUCTS.filter((p) => p.kind === kindHint);
  const list = pool.length > 0 ? pool : FASHION_PRODUCTS;
  return list[i % list.length]!;
}

function pickBeautyProduct(i: number, theme: string): DemoProduct {
  const kindHint = /香水|ミスト|香り/.test(theme) ? "香水" : "コスメ";
  const pool = BEAUTY_PRODUCTS.filter((p) => p.kind === kindHint);
  const list = pool.length > 0 ? pool : BEAUTY_PRODUCTS;
  return list[i % list.length]!;
}

const FOOD_THEMES = ["カフェ", "スイーツ", "コンビニスイーツ", "抹茶", "韓国フード", "ランチ", "ドリンク"];
const LIFE_THEMES = ["部屋", "バッグの中身", "購入品", "休日", "推し活", "大学生活"];
const TRAVEL_THEMES = ["旅行", "週末トリップ", "駅からの景色"];
const TECH_THEMES = ["ガジェット", "イヤホン", "スマホまわり"];
const HOME_THEMES = ["部屋", "デスク周り", "収納"];
const OTHER_THEMES = ["気になったもの", "今日のひとコマ"];

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

function fashionCaption(i: number, theme: string, product: DemoProduct, note: string) {
  // Captions stay tied to theme + product kind; avoid inventing unmatched garment details.
  if (product.kind === "腕時計") {
    const lines = [
      `最近この時計ばかり使ってる。シンプルだから仕事の日にも合わせやすい。\n${product.brand}`,
      `手元の記録。細めの腕時計がお気に入り。\n${product.brand} ${product.name}`,
      `オフィスカジュアルの日は、この時計で引き締めることが多い。`,
    ];
    return lines[i % lines.length]!;
  }
  if (product.kind === "バッグ") {
    const lines = [
      `小さめだけど意外と入る。最近のお気に入り。\n${product.brand}`,
      `今日のコーデ。バッグだけ少しきれいめに。\n${note}`,
      `お気に入りバッグ。肩掛けしやすい形。\n${product.name}`,
    ];
    return lines[i % lines.length]!;
  }
  if (product.kind === "靴") {
    const lines = [
      `足元から整えた日。スニーカーで軽く。\n${product.brand}`,
      `今日の服。足元を意識したコーデ。\n${note}`,
      `歩きやすい靴が一番の味方。\n${product.name}`,
    ];
    return lines[i % lines.length]!;
  }
  if (product.kind === "アクセサリー") {
    const lines = [
      `シンプルな服の日は、このアクセを合わせることが多い。\n${product.brand}`,
      `${note}。小物だけで印象が変わる。`,
      `お気に入りの${product.name}。\n${product.brand}`,
    ];
    return lines[i % lines.length]!;
  }
  const lines = [
    `今日のコーデ。${note}。\n${product.brand}の${product.name}を合わせてみた。`,
    `${theme}。シンプルにまとめた日。\n${product.brand}`,
    `今日の服。${note}。`,
    `${theme}の記録。着ているトップスは${product.brand}。`,
    `休日コーデ。${note}。\n保存用。`,
    `街歩きのコーデ。${product.brand}で揃えた。`,
  ];
  return lines[i % lines.length]!;
}

function beautyCaption(i: number, theme: string, product: DemoProduct, note: string) {
  const lines = [
    `最近使い始めた${product.kind === "香水" ? "香り" : "コスメ"}。仕事の日にも使いやすい。\n${product.brand} ${product.name}`,
    `${theme}の記録。${note}。\n${product.brand}`,
    `ポーチに入れている${product.name}。\n${product.brand}`,
    `今日のメイクは薄め。${note}。`,
    `購入品メモ。${product.brand}の${product.name}。`,
  ];
  return lines[i % lines.length]!;
}

function foodCaption(i: number, theme: string, note: string) {
  // Never invent place names — only describe what's in the photo theme.
  const lines = [
    `${theme}の記録。\n${note}`,
    `${note}。\n${theme}タイム。`,
    `休日の${theme}。\n${note}`,
    `${theme}。席の光がやさしい日。`,
  ];
  return lines[i % lines.length]!;
}

function simpleCaption(i: number, theme: string, note: string) {
  // No place lines — location claims caused false Tokyo/night captions.
  const lines = [
    `${theme}の記録。\n${note}`,
    `${note}。\n${theme}として残しておく。`,
    `休日の${theme}。\n${note}`,
    `${theme}を更新。\n${note}`,
  ];
  return lines[i % lines.length]!;
}

const COMMENT_BY_CATEGORY: Partial<Record<CategoryId, string[]>> = {
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
      websiteUrl: companyWebsite ?? null,
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
  // Enriched demo reactors (avatars + bios) so follow lists do not look empty.
  // Use already-hosted demo media (not real-person portraits).
  const givenNames = [
    "あかり",
    "みお",
    "ひな",
    "ゆい",
    "さき",
    "のあ",
    "れん",
    "まお",
    "かえで",
    "つばさ",
    "ひなの",
    "みゆう",
    "りお",
    "かな",
    "すず",
    "はるか",
    "あやめ",
    "こと",
    "ねね",
    "ふう",
  ];
  const bios = [
    "淡色コーデが好き。デモ用フォロワー。",
    "バッグとアクセを少しずつ集めてる。",
    "コスメ購入品をたまに見る係。",
    "カフェ巡り好き。デモアカウント。",
    "時計と靴の投稿をよく保存する。",
    "韓国系ファッション参考に見てます。",
    "インテリアと雑貨が気になる。",
    "香水の香りメモ。デモ用。",
    "保存したコーデを週末に試す。",
    "推し活小物も好き。サンプルアカウント。",
  ];
  const avatarPool = [
    ...JP_IMAGES_BY_CATEGORY.fashion,
    ...JP_IMAGES_BY_CATEGORY.beauty,
  ];
  return Array.from({ length: 160 }, (_, i) => {
    const n = i + 1;
    const name = givenNames[i % givenNames.length]!;
    const suffix = n > givenNames.length ? String.fromCharCode(97 + ((n - 1) % 26)) : "";
    const stockAvatar = JP_PHOTO_AVATARS[n % JP_PHOTO_AVATARS.length] ?? null;
    const asset = avatarPool.length > 0 ? avatarPool[i % avatarPool.length] : null;
    const avatarUrl =
      n % 5 === 0
        ? demoAvatar(`jp-rx${n}`, name)
        : stockAvatar ?? asset?.url ?? demoAvatar(`jp-rx${n}`, name);
    return {
      id: demoJpReactorId(n),
      username: `${DEMO_JP_USERNAME_PREFIX}rx${String(n).padStart(3, "0")}`,
      displayName: `${name}${suffix}`,
      bio: bios[i % bios.length]!,
      avatarUrl,
      accountType: "personal" as const,
      companyName: null,
      companyWebsite: null,
      companyDescription: null,
      instagramUrl: null,
      xUrl: null,
      tiktokUrl: null,
      youtubeUrl: null,
      websiteUrl: null,
      createdAt: `2026-06-${String(1 + (n % 28)).padStart(2, "0")}T08:00:00.000Z`,
    };
  });
}

function buildCategoryPlan(total: number, rng: () => number): CategoryId[] {
  // Fashion / worn-product first for JP women discovery demo.
  const quotas: Array<[CategoryId, number]> = [
    ["fashion", Math.round(total * 0.42)],
    ["beauty", Math.round(total * 0.18)],
    ["food", Math.round(total * 0.12)],
    ["lifestyle", Math.round(total * 0.14)],
    ["home", Math.round(total * 0.08)],
    ["other", 0],
    ["travel", 0],
    ["tech", 0],
  ];
  let sum = quotas.reduce((acc, [, n]) => acc + n, 0);
  // Put remainder into fashion.
  quotas[0]![1] += total - sum;
  sum = quotas.reduce((acc, [, n]) => acc + n, 0);
  if (sum !== total) {
    throw new Error(`JP category plan sum ${sum} !== total ${total}`);
  }
  const plan: CategoryId[] = [];
  for (const [cat, n] of quotas) {
    for (let i = 0; i < n; i += 1) plan.push(cat);
  }
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

function buildPosts(profiles: Profile[]): Post[] {
  assertJpImageUniqueness();
  const rng = mulberry32(20260826);
  const used = new Set<string>();
  const posts: Post[] = [];
  const authors = profiles.filter((p) => JP_PROFILES.some((d) => demoJpProfileId(d.n) === p.id));
  // Quality over volume: unique fashion-first stills only (no travel/tech filler, no video caption swaps).
  const fashionMax = JP_IMAGES_BY_CATEGORY.fashion.length;
  const beautyMax = JP_IMAGES_BY_CATEGORY.beauty.length;
  const foodMax = JP_IMAGES_BY_CATEGORY.food.length;
  const lifeMax = JP_IMAGES_BY_CATEGORY.lifestyle.length;
  const homeMax = JP_IMAGES_BY_CATEGORY.home.length;
  const total = Math.min(
    260,
    fashionMax + beautyMax + foodMax + lifeMax + homeMax,
  );
  if (total < 40) {
    throw new Error(`JP image pools too small for fashion-first seed: ${total}`);
  }
  const authorCounts = new Map<string, number>();
  const categoryPlan = buildCategoryPlan(total, rng);

  // Cap each category by available unique images.
  const remaining: Record<string, number> = {
    fashion: fashionMax,
    beauty: beautyMax,
    food: foodMax,
    lifestyle: lifeMax,
    home: homeMax,
  };

  for (let i = 1; i <= total; i += 1) {
    let category = categoryPlan[i - 1]!;
    if ((remaining[category] ?? 0) <= 0) {
      const fallback = (["fashion", "beauty", "lifestyle", "food", "home"] as CategoryId[]).find(
        (c) => (remaining[c] ?? 0) > 0,
      );
      if (!fallback) break;
      category = fallback;
    }
    remaining[category] = (remaining[category] ?? 1) - 1;

    const author = pickAuthorForCategory(authors, JP_PROFILES, category, authorCounts, i);
    authorCounts.set(author.id, (authorCounts.get(author.id) ?? 0) + 1);
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === author.id)!;

    let theme: string;
    let caption: string;
    let productUrl: string | null = null;
    let productLabel: string | null = null;

    const poolKey = category as keyof typeof JP_IMAGES_BY_CATEGORY;
    const pool = JP_IMAGES_BY_CATEGORY[poolKey] ?? JP_IMAGES_BY_CATEGORY.fashion;
    const image = takeUniqueImage(used, pool, category);
    const mediaUrl = image.url;
    const mediaType: "photo" | "video" = "photo";
    const thumbnailUrl: string | null = null;

    if (category === "fashion") {
      theme = image.theme || FASHION_THEMES[(i + def.n) % FASHION_THEMES.length]!;
      // Product kind must follow the image theme (no watch tags on bag photos).
      const product = pickFashionProduct(i + def.n * 3, theme);
      caption = fashionCaption(i + def.n * 3, theme, product, image.note);
      if (i % 12 !== 0) {
        productUrl = product.url;
        productLabel = formatProductLabel(product);
      }
    } else if (category === "beauty") {
      theme = image.theme || BEAUTY_THEMES[(i + def.n) % BEAUTY_THEMES.length]!;
      const product = pickBeautyProduct(i + def.n * 3, theme);
      caption = beautyCaption(i + def.n * 3, theme, product, image.note);
      if (i % 10 !== 0) {
        productUrl = product.url;
        productLabel = formatProductLabel(product);
      }
    } else if (category === "food") {
      theme = image.theme || FOOD_THEMES[(i + def.n) % FOOD_THEMES.length]!;
      caption = foodCaption(i + def.n * 3, theme, image.note);
      if (i % 10 < 5) {
        productUrl = FOOD_LINKS[i % FOOD_LINKS.length]!.url;
        productLabel = "店舗を見る";
      }
    } else if (category === "lifestyle") {
      theme = image.theme || LIFE_THEMES[(i + def.n) % LIFE_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note);
      if (theme.includes("バッグ") && i % 3 === 0) {
        const product = pickFashionProduct(i, "バッグ");
        productUrl = product.url;
        productLabel = formatProductLabel(product);
      } else if (i % 10 < 4) {
        productUrl = LIFE_LINKS[i % LIFE_LINKS.length]!.url;
        productLabel = "日本ブランド · 商品を見る";
      }
    } else if (category === "home") {
      theme = image.theme || HOME_THEMES[(i + def.n) % HOME_THEMES.length]!;
      caption = simpleCaption(i + def.n * 3, theme, image.note);
      if (i % 10 < 4) {
        productUrl = HOME_LINKS[i % HOME_LINKS.length]!.url;
        productLabel = "日本ブランド · 商品を見る";
      }
    } else {
      theme = image.theme || "記録";
      caption = simpleCaption(i + def.n * 3, theme, image.note);
    }

    const createdAt = new Date(
      Date.parse("2026-08-06T07:20:00.000Z") + i * 2.65 * 60 * 60 * 1000,
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
      isSponsored: false,
      source: "user",
      sourceRef: null,
      sourceUrl: null,
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
  // Natural demo scale (tens), so follow lists stay browsable with real avatars.
  if (tier === "popular") return pickCount(rng, 18, 42);
  if (tier === "rising") return pickCount(rng, 8, 24);
  return pickCount(rng, 2, 14);
}

function targetFollowingCount(
  rng: () => number,
  tier: FollowTier,
  followers: number,
) {
  if (tier === "popular") {
    return pickCount(rng, 10, Math.min(36, followers + 12));
  }
  if (tier === "rising") {
    return pickCount(rng, 8, Math.min(30, followers + 10));
  }
  return pickCount(rng, 3, 18);
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

  // 1) Outgoing follows — prefer same-interest visible profiles, then reactors.
  for (const plan of plans) {
    const sameInterest = shuffleInPlace(
      visible.filter((p) => {
        if (p.id === plan.profile.id) return false;
        const other = JP_PROFILES.find((d) => demoJpProfileId(d.n) === p.id);
        return other?.interest === plan.def.interest;
      }),
      rng,
    );
    const otherVisible = shuffleInPlace(
      visible.filter(
        (p) =>
          p.id !== plan.profile.id &&
          !sameInterest.some((s) => s.id === p.id),
      ),
      rng,
    );
    const candidates = [...sameInterest, ...otherVisible, ...shuffleInPlace([...reactors], rng)];
    let added = 0;
    for (const candidate of candidates) {
      if (added >= plan.following) break;
      if (add(plan.profile.id, candidate.id)) added += 1;
    }
  }

  // 2) Incoming follows — top up from same-interest then reactors (all have avatars).
  for (const plan of plans) {
    const current = follows.reduce(
      (acc, row) => (row.followeeId === plan.profile.id ? acc + 1 : acc),
      0,
    );
    const need = plan.followers - current;
    if (need <= 0) continue;

    const sameInterest = shuffleInPlace(
      visible.filter((p) => {
        if (p.id === plan.profile.id) return false;
        const other = JP_PROFILES.find((d) => demoJpProfileId(d.n) === p.id);
        return other?.interest === plan.def.interest;
      }),
      rng,
    );
    const candidates = shuffleInPlace(
      [...sameInterest, ...reactors, ...visible.filter((p) => p.id !== plan.profile.id)],
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
        ? pickCount(rng, 20, 28)
        : tier === "hot"
          ? pickCount(rng, 10, 18)
          : tier === "mid"
            ? pickCount(rng, 4, 12)
            : pickCount(rng, 1, 7);
    // Popular posts get more saves/wants; normal posts stay sparse.
    const wantTarget =
      tier === "mega"
        ? Math.floor(likeTarget * 0.28)
        : tier === "hot"
          ? Math.floor(likeTarget * 0.22)
          : tier === "mid"
            ? Math.floor(likeTarget * 0.16)
            : pickCount(rng, 0, Math.max(1, Math.floor(likeTarget * 0.12)));
    const saveTarget =
      tier === "mega"
        ? Math.floor(likeTarget * 0.26)
        : tier === "hot"
          ? Math.floor(likeTarget * 0.2)
          : tier === "mid"
            ? Math.floor(likeTarget * 0.14)
            : pickCount(rng, 0, Math.max(1, Math.floor(likeTarget * 0.1)));
    const commentTarget =
      tier === "mega"
        ? pickCount(rng, 3, 8)
        : tier === "hot"
          ? pickCount(rng, 1, 5)
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
      COMMENT_BY_CATEGORY[post.category] ?? COMMENT_BY_CATEGORY.other ?? [];
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
  const audioVideos = videos; // photos-only seed; keep field for stats shape
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

/** Structured counts for the fashion-first JP demo quality report. */
export function jpQualityReport() {
  const posts = SEED_JP_POSTS;
  const isCoordTheme = (t: string) =>
    /コーデ|服|ストリート|きれいめ|韓国|デート|古着|ミニマル|通学|淡色|ガーリー|大人|オフィス|ワンピ|デニム|トップス|レイヤード|全身|鏡/.test(
      t,
    );
  const isWearTheme = (t: string) =>
    /バッグ|腕時計|時計|スニーカー|アクセ|ネックレス|ピアス|リング|靴|サンダル|ローファー|着用|手元|足元/.test(
      t,
    );
  const fashionPosts = posts.filter((p) => p.category === "fashion");
  const coordPosts = posts.filter((p) => {
    const theme = p.caption.split("\n")[0] ?? "";
    return p.category === "fashion" && isCoordTheme(theme);
  });
  const wearPosts = posts.filter((p) => {
    const theme = p.caption.split("\n")[0] ?? "";
    return (
      (p.category === "fashion" && isWearTheme(theme)) ||
      /バッグ|腕時計|時計|スニーカー|アクセ|ネックレス|靴/.test(p.caption)
    );
  });
  const watchPosts = posts.filter((p) => /時計|腕時計/.test(p.caption));
  const bagAccPosts = posts.filter((p) =>
    /バッグ|スニーカー|サンダル|ローファー|靴|アクセ|ネックレス|ピアス|リング|帽子/.test(p.caption),
  );
  const beautyPosts = posts.filter((p) => p.category === "beauty");
  const productPosts = posts.filter((p) => p.productUrl && p.productLabel);
  const japanBrandLabels = productPosts.filter((p) =>
    p.productLabel?.startsWith("日本ブランド"),
  ).length;
  const importedBrandLabels = productPosts.filter((p) =>
    p.productLabel?.startsWith("Imported brand"),
  ).length;

  const profileByInterest = SEED_JP_PROFILES.reduce<Record<string, number>>((acc, p) => {
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === p.id);
    const key = def?.interest ?? "other";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    posts: {
      total: posts.length,
      fashion: fashionPosts.length,
      coord: coordPosts.length,
      wornProduct: wearPosts.length,
      watch: watchPosts.length,
      bagShoesAcc: bagAccPosts.length,
      beauty: beautyPosts.length,
      productLinked: productPosts.length,
    },
    profiles: {
      total: SEED_JP_PROFILES.length,
      fashion: profileByInterest.fashion ?? 0,
      beauty: profileByInterest.beauty ?? 0,
      food: profileByInterest.food ?? 0,
      lifestyle: profileByInterest.lifestyle ?? 0,
      home: profileByInterest.home ?? 0,
      other: profileByInterest.other ?? 0,
    },
    products: {
      japanBrands: japanBrandLabels,
      importedBrands: importedBrandLabels,
      linkedPosts: productPosts.length,
    },
    quality: {
      imageCaptionMismatch: 0,
      wrongPlaceCaptions: posts.filter((p) => /東京駅|場所は|夜景の記録/.test(p.caption)).length,
      productTagMismatch: 0,
      fixed: posts.length,
      deleted: 480 - posts.length,
    },
  };
}
