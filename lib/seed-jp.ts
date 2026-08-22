import type { AccountType, CategoryId, Comment, Post, Profile } from "@/lib/types";

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

type Interest = "fashion" | "beauty" | "food" | "lifestyle";

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

const AV = {
  a: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&h=200&q=80",
  b: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80",
  c: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80",
  d: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&h=200&q=80",
  e: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&h=200&q=80",
  f: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80",
  g: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&h=200&q=80",
  h: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80",
  i: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&h=200&q=80",
  j: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&h=200&q=80",
};

const JP_PROFILES: ProfileDef[] = [
  { n: 1, slug: "mio", displayName: "みお", bio: "淡色とカーディガンが好き。通学コーデ多め。", avatarUrl: AV.a, accountType: "personal", interest: "fashion" },
  { n: 2, slug: "hanae", displayName: "はなえ", bio: "プチプラコスメとポーチの中身メモ。", avatarUrl: AV.b, accountType: "personal", interest: "beauty" },
  { n: 3, slug: "yuna", displayName: "ゆな", bio: "渋谷と下北のカフェ巡り。", avatarUrl: AV.c, accountType: "personal", interest: "food" },
  { n: 4, slug: "saki", displayName: "さき", bio: "部屋とネイルと休日の記録。", avatarUrl: AV.d, accountType: "personal", interest: "lifestyle" },
  { n: 5, slug: "rin", displayName: "りん", bio: "韓国っぽコーデをゆるく研究中。", avatarUrl: AV.e, accountType: "personal", interest: "fashion" },
  { n: 6, slug: "aoi", displayName: "あおい", bio: "学校でも浮かないナチュラルメイク。", avatarUrl: AV.f, accountType: "personal", interest: "beauty" },
  { n: 7, slug: "miku", displayName: "みく", bio: "アサイーボウルとクロッフルが好き。", avatarUrl: AV.g, accountType: "personal", interest: "food" },
  { n: 8, slug: "nana", displayName: "なな", bio: "バッグの中身とスマホケース収集。", avatarUrl: AV.h, accountType: "personal", interest: "lifestyle" },
  { n: 9, slug: "kaho", displayName: "かほ", bio: "ガーリー寄りのデートコーデ。", avatarUrl: AV.a, accountType: "personal", interest: "fashion" },
  { n: 10, slug: "eri", displayName: "えり", bio: "涙袋と束感まつ毛が最近の宿題。", avatarUrl: AV.b, accountType: "personal", interest: "beauty" },
  { n: 11, slug: "honoka", displayName: "ほのか", bio: "韓国カフェと新作スイーツ。", avatarUrl: AV.j, accountType: "personal", interest: "food" },
  { n: 12, slug: "yui", displayName: "ゆい", bio: "推し活グッズと休日の写真。", avatarUrl: AV.d, accountType: "personal", interest: "lifestyle" },
  { n: 13, slug: "mei", displayName: "めい", bio: "平成レトロとプリーツが好き。", avatarUrl: AV.i, accountType: "personal", interest: "fashion" },
  { n: 14, slug: "sara", displayName: "さら", bio: "ドラッグストア購入品をよく撮る。", avatarUrl: AV.e, accountType: "personal", interest: "beauty" },
  { n: 15, slug: "ichika", displayName: "いちか", bio: "コンビニ新商品とランチ記録。", avatarUrl: AV.g, accountType: "personal", interest: "food" },
  { n: 16, slug: "fuka", displayName: "ふうか", bio: "デスク周りと香水の匂いメモ。", avatarUrl: AV.h, accountType: "personal", interest: "lifestyle" },
  { n: 17, slug: "akari", displayName: "あかり", bio: "Y2K寄りのストリートも着ます。", avatarUrl: AV.a, accountType: "personal", interest: "fashion" },
  { n: 18, slug: "moe", displayName: "もえ", bio: "リップとグロスの沼。", avatarUrl: AV.f, accountType: "personal", interest: "beauty" },
  { n: 19, slug: "hinata", displayName: "ひなた", bio: "東京カフェの席選びが趣味。", avatarUrl: AV.c, accountType: "personal", interest: "food" },
  { n: 20, slug: "kotone", displayName: "ことね", bio: "ネイルと旅行の写真多め。", avatarUrl: AV.d, accountType: "personal", interest: "lifestyle" },
  { n: 21, slug: "reina", displayName: "れいな", bio: "きれいめカジュアルの大学生コーデ。", avatarUrl: AV.i, accountType: "personal", interest: "fashion" },
  { n: 22, slug: "misa", displayName: "みさ", bio: "韓国メイクを薄めに落とすのが好き。", avatarUrl: AV.b, accountType: "personal", interest: "beauty" },
  { n: 23, slug: "an", displayName: "あん", bio: "映えスイーツより味優先、でも写真は撮る。", avatarUrl: AV.j, accountType: "personal", interest: "food" },
  { n: 24, slug: "suzuka", displayName: "すずか", bio: "部屋紹介と休日の朝。", avatarUrl: AV.e, accountType: "personal", interest: "lifestyle" },
  { n: 25, slug: "maho", displayName: "まほ", bio: "古着とデニムでバランスを取る。", avatarUrl: AV.g, accountType: "personal", interest: "fashion" },
  { n: 26, slug: "chika", displayName: "ちか", bio: "平成っぽメイクをたまにやりたくなる。", avatarUrl: AV.h, accountType: "personal", interest: "beauty" },
  { n: 27, slug: "nagi", displayName: "なぎ", bio: "ドリンクの新作を先に飲む係。", avatarUrl: AV.a, accountType: "personal", interest: "food" },
  { n: 28, slug: "toha", displayName: "とは", bio: "ライブ参戦コーデの記録。", avatarUrl: AV.f, accountType: "personal", interest: "fashion" },
  { n: 29, slug: "emiri", displayName: "えみり", bio: "ワンホン系の淡色が最近のマイブーム。", avatarUrl: AV.c, accountType: "personal", interest: "fashion" },
  { n: 30, slug: "risa", displayName: "りさ", bio: "パケ買いしがちなコスメ棚。", avatarUrl: AV.d, accountType: "personal", interest: "beauty" },
  { n: 31, slug: "kokona", displayName: "ここな", bio: "通学コーデは動きやすさ優先。", avatarUrl: AV.i, accountType: "personal", interest: "fashion" },
  { n: 32, slug: "yume", displayName: "ゆめ", bio: "今日のメイクを短く残す。", avatarUrl: AV.b, accountType: "personal", interest: "beauty" },
  { n: 33, slug: "airi", displayName: "あいり", bio: "カフェの席と光の入り方を見る。", avatarUrl: AV.j, accountType: "personal", interest: "food" },
  { n: 34, slug: "noa", displayName: "のあ", bio: "きれいめ寄りの休日コーデ。", avatarUrl: AV.e, accountType: "personal", interest: "fashion" },
  { n: 35, slug: "himari", displayName: "ひまり", bio: "ポーチの中身を季節で入れ替える。", avatarUrl: AV.h, accountType: "personal", interest: "lifestyle" },
  { n: 36, slug: "closetnote", displayName: "CLOSET NOTE", bio: "デイリーに着たい服のメモ帳。", avatarUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "fashion", companyName: "CLOSET NOTE", companyWebsite: "https://www.gu-global.com/jp/", companyDescription: "若年層向けのコーディネート紹介アカウント。" },
  { n: 37, slug: "palecloset", displayName: "pale closet", bio: "淡色とガーリーのセレクト。", avatarUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "fashion", companyName: "pale closet", companyWebsite: "https://grl.jp/", companyDescription: "デモ用のファッションセレクト。" },
  { n: 38, slug: "streetmini", displayName: "STREET MINI", bio: "ミニスカートとスニーカーの組み合わせ。", avatarUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "fashion", companyName: "STREET MINI", companyWebsite: "https://wego.jp/", companyDescription: "カジュアル寄りのショップアカウント。" },
  { n: 39, slug: "retropop", displayName: "RETRO POP", bio: "平成レトロとY2Kの間。", avatarUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "fashion", companyName: "RETRO POP", companyWebsite: "https://www.palcloset.jp/", companyDescription: "レトロ寄りのデモショップ。" },
  { n: 40, slug: "nicedaily", displayName: "NICE daily", bio: "通学とデートで着回せる服。", avatarUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "fashion", companyName: "NICE daily", companyWebsite: "https://www.niceclaup.jp/", companyDescription: "デイリーウェアの紹介。" },
  { n: 41, slug: "pouchlab", displayName: "POUCH LAB", bio: "プチプラコスメの試し記録。", avatarUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "beauty", companyName: "POUCH LAB", companyWebsite: "https://www.canmake.com/", companyDescription: "コスメ紹介のデモアカウント。" },
  { n: 42, slug: "lipnote", displayName: "LIP NOTE", bio: "リップとグロスの色見本。", avatarUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "beauty", companyName: "LIP NOTE", companyWebsite: "https://www.cezanne.co.jp/", companyDescription: "リップ中心のデモショップ。" },
  { n: 43, slug: "krbeauty", displayName: "KR BEAUTY", bio: "韓国コスメのパッケージが好き。", avatarUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "beauty", companyName: "KR BEAUTY", companyWebsite: "https://www.etude.com/", companyDescription: "韓国コスメ紹介のデモアカウント。" },
  { n: 44, slug: "basehour", displayName: "BASE HOUR", bio: "ベースメイクと学校メイク。", avatarUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "beauty", companyName: "BASE HOUR", companyWebsite: "https://www.shiseido.co.jp/maquillage/", companyDescription: "ベースメイクのデモ紹介。" },
  { n: 45, slug: "cafewalk", displayName: "CAFE WALK", bio: "東京と韓国カフェの席写真。", avatarUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "food", companyName: "CAFE WALK", companyWebsite: "https://www.starbucks.co.jp/", companyDescription: "カフェ巡りのデモアカウント。" },
  { n: 46, slug: "sweetdesk", displayName: "SWEET DESK", bio: "新作スイーツとドリンク。", avatarUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "food", companyName: "SWEET DESK", companyWebsite: "https://www.starbucks.co.jp/", companyDescription: "スイーツ紹介のデモアカウント。" },
  { n: 47, slug: "roomnote", displayName: "ROOM NOTE", bio: "部屋とデスク周りの小さな更新。", avatarUrl: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "lifestyle", companyName: "ROOM NOTE", companyWebsite: "https://www.muji.com/jp/", companyDescription: "インテリア寄りのデモアカウント。" },
  { n: 48, slug: "nailtrip", displayName: "NAIL TRIP", bio: "ネイルと旅行の写真帳。", avatarUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=200&h=200&q=80", accountType: "business", interest: "lifestyle", companyName: "NAIL TRIP", companyWebsite: "https://www.muji.com/jp/", companyDescription: "ネイルと休日のデモアカウント。" },
];

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
  { name: "titty&Co.", url: "https://www.tittyandco.jp/" },
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
  { name: "fwee", url: "https://fwee.co.kr/" },
  { name: "rom&nd", url: "https://www.romand.co.kr/" },
  { name: "milktouch", url: "https://milktouch.co.kr/" },
  { name: "VDL", url: "https://www.vdlcosmetic.com/" },
  { name: "minum", url: "https://www.oliveyoung.co.kr/" },
];

const FOOD_LINKS = [
  { url: "https://www.starbucks.co.jp/" },
  { url: "https://www.family.co.jp/" },
  { url: "https://www.goncharoff.co.jp/" },
];

const LIFE_LINKS = [
  { url: "https://www.muji.com/jp/" },
  { url: "https://www.ikea.com/jp/ja/" },
];

const FASHION_THEMES = [
  "韓国っぽコーデ", "淡色コーデ", "ワンホン系", "ガーリー", "平成レトロ", "Y2K", "ストリート",
  "古着", "きれいめ", "カジュアル", "通学コーデ", "大学生コーデ", "デートコーデ", "夏コーデ",
  "秋先取り", "ライブ参戦コーデ", "推し活コーデ", "ミニスカート", "デニム", "カーゴパンツ",
  "プリーツスカート", "シアートップス", "カーディガン", "ワンピース", "バッグ", "スニーカー",
  "アクセサリー", "ドラマ衣装っぽいワンピ", "モデルっぽい休日コーデ", "芸能人風きれいめコーデ",
];

const BEAUTY_THEMES = [
  "学校メイク", "ナチュラルメイク", "涙袋", "束感まつ毛", "リップ", "グロス", "チーク",
  "アイライナー", "ベースメイク", "韓国メイク", "平成っぽメイク", "パケ買い", "ポーチの中身",
  "今日のメイク", "購入品紹介", "ドラッグストア購入品", "プチプラコスメ",
];

const FOOD_THEMES = [
  "東京カフェ", "韓国カフェ", "新作スイーツ", "アサイーボウル", "クロッフル", "ドリンク",
  "コンビニ新商品", "カフェ巡り", "映えスイーツ", "ランチ",
];

const LIFE_THEMES = [
  "バッグの中身", "ポーチの中身", "部屋紹介", "デスク周り", "ネイル", "香水",
  "スマホケース", "推し活グッズ", "旅行", "休日",
];

const FASHION_IMAGES = [
  "1521572163474-6864f9cf17ab", "1489987707025-afc232f7ea0f", "1490481651871-ab68de25d43d",
  "1515886657613-9f3515b0c78f", "1525507119028-ed4c629a60a3", "1469334031218-e382a71b716b",
  "1487222477890-8d468c566260", "1519741497674-611481863552", "1434389677669-e08b4cac3107",
  "1475180098004-ca77a66827be", "1483985988106-5a444bfd0855", "1495121605193-b116b5b9c5fe",
  "1503342217505-b0a15ec3261c", "1512436991641-6745cdb1723f", "1523359346246-1d8d70969b4a",
  "1551488831-00a57f5a6b32", "1562157873-818bc0726f68", "1576566588028-4147f3842f27",
  "1583292650898-7d22cd27ca6f", "1594633312681-425c7b97ccd1", "1603252109360-909baaf261fd",
  "1617137968427-85924c800a22", "1624204386084-9da776632fc7", "1520975954732-35ac2460fc65",
  "1509631175647-303152414ceb", "1515378791036-0648a3ef77b2", "1544717305-2782549b5136",
  "1558618666-fcd25c85f82e", "1567401893414-76b7b1e5a7a5", "1578932750294-f5075ed6fc59",
  "1581044777550-4cfa60707c03", "1595776613215-fe04b78de7d0", "1601762603332-ae97e2890687",
  "1621184455862-c533ba4eabce", "1541099649032-18d8914e8a0c", "1516826957135-700dedea998c",
  "1532453288672-3a27e9be9ed6", "1560243563-062bfc001d68", "1571945153237-4929e783af4a",
  "1558766611-2d538c509768", "1558171813-4c8840216053", "1549298916-b547d66f3a4a",
];

const BEAUTY_IMAGES = [
  "1556228720-195a672e8a03", "1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348",
  "1611930022073-b7a4ba5fcccd", "1571781926291-c477ebfd024b", "1512496015851-a90fb479ba36",
  "1515688594390-b649df4936b7", "1522337660859-02fbefca4702", "1586495777744-4413f21062fa",
  "1598440947619-2c35fc72c884", "1608248543803-ba4f8c27ae75", "1616394584738-fc6e612e71b9",
  "1620916566398-39f1143ab7be", "1515377905703-c4788e51af15", "1487412947146-5bad2030bbda",
  "1492106087820-71f1a00d2b11", "1505944270255-72b8c68c50c5", "1522337094846-8a818192de1f",
  "1535632066927-ab7c9ab60908", "1540555700478-4be289fbecef", "1556228578-0d85b1a4d571",
  "1563170351-be82bc888aa4", "1570172619644-dfd03ed5d881", "1583241800698-e8ab01830cc3",
  "1596704017254-9b121068ec31", "1604654894610-df63bc536371", "1616683693504-3ea7e9ba6ced",
  "1621605815971-fbc98d665033", "1487412720507-e7ab37603c6f",
];

const FOOD_IMAGES = [
  "1495474472287-4d71bcdd2085", "1504674900247-0877df9cc836", "1512621776951-a57141f2eefd",
  "1476224203421-9ac39bcb3327", "1467003909585-2f8a72700288", "1497534447292-69de707efe17",
  "1505253758473-96b7015fcd40", "1511920170031-afbad08254a3", "1509042239860-f550ce710b93",
  "1514432324607-a09d9b4aefb4", "1551024506-0bccd828d307", "1563805042-7684c019e1cb",
  "1481391319762-47dff72990b5", "1497051073900-47d073d36f1f", "1525351484163-7529414344d8",
  "1541167760496-1628856ab772", "1565299624946-b28f40a0ae38", "1578985545062-69928b1d9587",
  "1432139555190-62d44779e296", "1484723091739-6aeb341a6d8c", "1499636134819-e0eb8aa2b809",
  "1506086679734-ee8bf6a6d1ad",
];

const LIFE_IMAGES = [
  "1485955900006-10f4d324d411", "1456735190827-d1262f71b8a1", "1441986300917-64674bd600d8",
  "1500530855697-b586d89ba3ee", "1478146896981-b80fe463b330", "1505691938895-1758d7feb511",
  "1493663284031-b7e3aefcae8e", "1555041469-a586c61ea9bc", "1616628182501-df0b0d2e0d2b",
  "1484480974691-166ee2e27e3b", "1604654894610-df63bc536371", "1515378791036-0648a3ef77b2",
  "1500534314209-a25ddb2bd429", "1469854523086-cc02fe5d8800", "1507525428034-b723cf961d3e",
  "1476514525535-07fb3b4ae5f1", "1488646953014-85cb44e25828", "1453928582365-b6ad33cbcf64",
  "1513364776144-60967b0f800f", "1523275335684-37898b6baf30",
];

/** Publicly playable sample MP4s (Google sample bucket). Not image URLs. */
const VIDEO_CLIPS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
];

const VIDEO_THEMES = [
  "コーデ紹介",
  "今日の服",
  "購入品紹介",
  "コスメ紹介",
  "メイク動画",
  "ネイル",
  "バッグの中身",
  "カフェ",
  "スイーツ",
  "推し活",
  "旅行",
  "ルックブック",
  "GRWM",
] as const;

function videoCaption(i: number, theme: (typeof VIDEO_THEMES)[number], category: CategoryId) {
  const lines: Record<(typeof VIDEO_THEMES)[number], string[]> = {
    コーデ紹介: [
      "今日のコーデ、動画の方が雰囲気伝わる気がする。\n動きながら撮ってみた。",
      "ルックブック風に回してみた。\n色のグラデがわかりやすいはず。",
    ],
    今日の服: [
      "今日の服、短めに撮った。\n朝はこれで十分だった。",
      "通学コーデを歩いてみた。\n靴の音まで残ってる。",
    ],
    購入品紹介: [
      "購入品紹介、中身開けながら。\nパケ見たい人向け。",
      "届いたものだけ動画で残す。\n写真より早い。",
    ],
    コスメ紹介: [
      "コスメ紹介、テクスチャが見えるように撮った。\n塗り比べは次の動画で。",
      "リップの発色だけ先に動画。\n写真だと透け感が弱い。",
    ],
    メイク動画: [
      "GRWM風に、ベースからざっくり。\n学校メイク寄り。",
      "涙袋だけ丁寧に塗るところ。\n短めのメイク動画。",
    ],
    ネイル: [
      "ネイル、角度を変えながら。\nラメの入り方が好き。",
      "短いネイルの質感。\nライブ前でも引っかからない。",
    ],
    バッグの中身: [
      "バッグの中身、出してみた。\nポーチが主役。",
      "中身チェック動画。\n余計なものが減った。",
    ],
    カフェ: [
      "カフェの席、店内を少しだけ回した。\n写真より空気感が出る。",
      "ドリンク来るまでの待ち時間動画。\n光がきれいだった。",
    ],
    スイーツ: [
      "スイーツ、切るところまで。\n食感は動画の方が伝わる。",
      "クロッフルの断面。\n熱いうちに撮った。",
    ],
    推し活: [
      "推し色の小物を並べただけ。\n参戦前の儀式。",
      "グッズ紹介を短く。\n本人コーデではなく雰囲気寄せ。",
    ],
    旅行: [
      "旅先の朝、窓からの光。\n短めの旅行メモ。",
      "駅から宿までの歩き。\n荷物は最小。",
    ],
    ルックブック: [
      "ルックブック風に3パターン。\n淡色多め。",
      "休日ルックを回してみた。\nきれいめ寄り。",
    ],
    GRWM: [
      "GRWM、朝のざっくり版。\nベースとリップだけ気合入れた。",
      "出かける前のGRWM。\nメイク薄め。",
    ],
  };
  const pool = lines[theme];
  const base = pool[i % pool.length]!;
  if (category === "fashion" && theme === "コーデ紹介") return base;
  return base;
}

function shouldBeVideo(i: number) {
  // ~40 of 360 posts (~11%): every 9th post starting at 3
  return i % 9 === 3;
}

function imageUrl(id: string, sig?: number) {
  const base = `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
  return sig === undefined ? base : `${base}&sig=${sig}`;
}

function uniqueImage(used: Set<string>, pool: string[], i: number) {
  for (const id of pool) {
    if (!used.has(id)) {
      used.add(id);
      return imageUrl(id);
    }
  }
  return imageUrl(pool[i % pool.length]!, i);
}

function fashionCaption(i: number, theme: string, brand: string) {
  const marks = ["🩷", "🤍", "✨", "🫧", "🎀"];
  const mark = marks[i % marks.length]!;
  const lines = [
    `最近この系統ばっかり着てる${mark}\n${theme}に寄せると、写真がまとめやすい。`,
    `${theme}、今日は${brand}で揃えてみた。\n主張しすぎないのがちょうどいい。`,
    `夏の${theme}。\n動きやすさ優先だけど、写真映えもしたい。`,
    `${theme}に合わせてみた。\n${brand}の形が、思ったより大人っぽい。`,
    `通学はこれで十分。\n${theme}寄りの淡色にして、靴だけ少しだけ主張。`,
    `デートの日の${theme}。\nスカート丈とバッグの大きさだけ悩んだ。`,
    `ライブ参戦コーデは軽さが命。\n${theme}でも歩ける靴にした。`,
    `推し色をワンポイントにした${theme}。\n本人コーデではなく、雰囲気だけ寄せてる。`,
    `韓国アイドルっぽいコーデにした日。\n${brand}のトップスが薄くて重ねやすい。`,
    `今っぽいガーリーに振った。\n${theme}は小物を減らすとまとまる。`,
    `ドラマ衣装っぽいワンピを休日に。\n${brand}で似た形を探した。`,
    `モデルっぽい休日コーデを意識しただけ。\n肩まわりがすっきりしてるのが好き。`,
    `芸能人風きれいめコーデ、雰囲気だけ。\n${theme}は色数を減らすとそれっぽくなる。`,
    `${brand}の${theme}。\n自分の中ではリピ候補。`,
    `秋先取りでカーディガンを一枚足した。\n${theme}のまま夕方まで寒くない。`,
    `GUと${brand}で組み合わせ。\n${theme}でも毎日着られる。`,
    `古着のデニムに${brand}のトップス。\n${theme}寄りだけどカジュアル。`,
  ];
  return lines[i % lines.length]!;
}

function beautyCaption(i: number, theme: string, brand: string) {
  const lines = [
    `学校でも浮かないナチュラルメイク。\nこのライナー、細く描けるのが好き。`,
    `${theme}、今日は${brand}で。\nパケがかわいくて手に取りやすい。`,
    `涙袋だけ丁寧に塗った日。\n${brand}の質感が、写真でも消えにくい。`,
    `束感まつ毛を薄めに作った。\n${theme}はやりすぎない方が自分に合う。`,
    `リップこの色ばっかり。\n${brand}は塗り直しが楽。`,
    `ポーチの中身、今月はこれ。\n${theme}用に小さめを選んだ。`,
    `ドラッグストアで見かけて試した。\n${brand}、プチプラなのに伸びがいい。`,
    `韓国メイクをかなり薄く落とした版。\nチークの位置だけ真似してる。`,
    `平成っぽメイクを夜だけ。\n${theme}は休日の方が気が楽。`,
    `今日のメイクはベース重視。\n${brand}の下地が、午後までヨレにくい。`,
    `購入品紹介。色は店頭で見て決めた。\n根拠のないランキングは信じない。`,
    `グロス多めの日。\n${theme}と相性いい気がする。`,
    `CANMAKEと${brand}を混ぜてみた。\n${theme}にはこれがしっくり。`,
    `今日のメイク、涙袋とチークだけ気合入れた。\n${brand}の発色がちょうどいい。`,
  ];
  return lines[i % lines.length]!;
}

function foodCaption(i: number, theme: string) {
  const places = ["渋谷", "原宿", "下北沢", "中目黒", "吉祥寺", "新大久保", "表参道", "池袋"];
  const place = places[i % places.length]!;
  const lines = [
    `${place}で見つけたカフェ。\n店内かわいすぎて写真撮りすぎた。`,
    `${theme}、今日は${place}。\n席の光がちょうどよかった。`,
    `クロッフルとラテ。\n甘さ控えめで、写真は先に撮った。`,
    `アサイーボウルの日。\n${place}の朝は並ばずに入れた。`,
    `韓国カフェっぽい内装が好きで寄った。\nドリンクの色がきれい。`,
    `コンビニ新商品、夜に食べた。\n${theme}枠として残しておく。`,
    `ランチは麺よりパン。\n${place}の窓際が空いてた。`,
    `映えスイーツより、食感で選んだ。\n結果として写真も残った。`,
    `${place}の新作スイーツ。\n友達と半分こした。`,
    `カフェ巡り3軒目。\n${theme}としてはここが一番落ち着いた。`,
  ];
  return lines[i % lines.length]!;
}

function lifeCaption(i: number, theme: string) {
  const lines = [
    `${theme}、今月の配置。\n小さいものを手前に置くと撮りやすい。`,
    `バッグの中身を入れ替えた。\nポーチが一つ減って軽い。`,
    `部屋の角だけ整えた。\n${theme}は光が入る時間に撮る。`,
    `デスク周りからケーブルを減らした。\nそれだけで写真がすっきりする。`,
    `ネイルは短め。\nライブの日でも引っかかりにくい。`,
    `香水は衣類に軽く。\n${theme}の写真と一緒に残す。`,
    `スマホケースを透明に戻した。\n推し活グッズは中にしまいがち。`,
    `休日の朝、部屋着のまま窓際。\n${theme}としてはこれで十分。`,
    `旅行の荷物は最小。\n写真用の一枚だけ気合を入れた。`,
    `ポーチの中身チェック。\n${theme}は季節ごとに入れ替える。`,
  ];
  return lines[i % lines.length]!;
}

const COMMENT_POOL = [
  "色味ちょうどいい",
  "これ学校でも使えそう",
  "リンク先見ます",
  "淡色でまとまってる",
  "バッグ気になる",
  "メイク薄めなの好き",
  "カフェどこですか",
  "保存した",
  "スカート丈かわいい",
  "リップの色味知りたい",
  "部屋の光きれい",
  "参戦コーデ参考になる",
  "プチプラ感出てていい",
  "次これ試してみる",
  "写真の角度好き",
];

function buildVisibleProfiles(): Profile[] {
  return JP_PROFILES.map((def) => ({
    id: demoJpProfileId(def.n),
    username: `${DEMO_JP_USERNAME_PREFIX}${def.slug}`,
    displayName: def.displayName,
    bio: def.bio,
    avatarUrl: def.avatarUrl,
    accountType: def.accountType,
    companyName: def.companyName ?? null,
    companyWebsite: def.companyWebsite ?? null,
    companyDescription: def.companyDescription ?? null,
    createdAt: `2026-06-${String(10 + (def.n % 18)).padStart(2, "0")}T09:00:00.000Z`,
  }));
}

/** Extra auth/profile rows so popular posts can reach 500+ unique likes. */
function buildReactors(): Profile[] {
  return Array.from({ length: 800 }, (_, i) => {
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
      createdAt: "2026-06-01T08:00:00.000Z",
    };
  });
}

function buildPosts(profiles: Profile[]): Post[] {
  const rng = mulberry32(20260823);
  const used = new Set<string>();
  const posts: Post[] = [];
  const authors = profiles.filter((p) => JP_PROFILES.some((d) => demoJpProfileId(d.n) === p.id));
  const total = 360;

  for (let i = 1; i <= total; i += 1) {
    const author = authors[(i - 1) % authors.length]!;
    const def = JP_PROFILES.find((d) => demoJpProfileId(d.n) === author.id)!;
    const roll = rng();
    let category: CategoryId;
    let theme: string;
    let caption: string;
    let productUrl: string | null = null;
    let productLabel: string | null = null;
    let mediaUrl: string;
    let mediaType: "photo" | "video" = "photo";
    let thumbnailUrl: string | null = null;
    const asVideo = shouldBeVideo(i);

    const forceFashion = def.interest === "fashion" || (def.accountType === "personal" && roll < 0.34);
    const forceBeauty = !forceFashion && (def.interest === "beauty" || roll < 0.58);
    const forceFood = !forceFashion && !forceBeauty && (def.interest === "food" || roll < 0.78);

    if (forceFashion) {
      category = "fashion";
      theme = FASHION_THEMES[(i + def.n) % FASHION_THEMES.length]!;
      const brand = FASHION_BRANDS[(i + def.n) % FASHION_BRANDS.length]!;
      caption = fashionCaption(i + def.n * 3, theme, brand.name);
      mediaUrl = uniqueImage(used, FASHION_IMAGES, i);
      if (i % 10 < 7) {
        productUrl = brand.url;
        productLabel = "商品を見る";
      }
    } else if (forceBeauty) {
      category = "beauty";
      theme = BEAUTY_THEMES[(i + def.n) % BEAUTY_THEMES.length]!;
      const brand = BEAUTY_BRANDS[(i + def.n) % BEAUTY_BRANDS.length]!;
      caption = beautyCaption(i + def.n * 3, theme, brand.name);
      mediaUrl = uniqueImage(used, BEAUTY_IMAGES, i);
      if (i % 10 < 7) {
        productUrl = brand.url;
        productLabel = "商品を見る";
      }
    } else if (forceFood) {
      category = "food";
      theme = FOOD_THEMES[(i + def.n) % FOOD_THEMES.length]!;
      caption = foodCaption(i + def.n * 3, theme);
      mediaUrl = uniqueImage(used, FOOD_IMAGES, i);
      if (i % 10 < 6) {
        productUrl = FOOD_LINKS[i % FOOD_LINKS.length]!.url;
        productLabel = "店舗を見る";
      }
    } else {
      category = "lifestyle";
      theme = LIFE_THEMES[(i + def.n) % LIFE_THEMES.length]!;
      caption = lifeCaption(i + def.n * 3, theme);
      mediaUrl = uniqueImage(used, LIFE_IMAGES, i);
      if (i % 10 < 6) {
        productUrl = LIFE_LINKS[i % LIFE_LINKS.length]!.url;
        productLabel = "商品を見る";
      }
    }

    if (asVideo) {
      const videoTheme = VIDEO_THEMES[(i + def.n) % VIDEO_THEMES.length]!;
      // Prefer theme-category alignment for a natural mix
      const alignedTheme =
        category === "fashion"
          ? (["コーデ紹介", "今日の服", "ルックブック", "購入品紹介", "推し活"] as const)[
              (i + def.n) % 5
            ]!
          : category === "beauty"
            ? (["メイク動画", "コスメ紹介", "GRWM", "ネイル", "購入品紹介"] as const)[
                (i + def.n) % 5
              ]!
            : category === "food"
              ? (["カフェ", "スイーツ"] as const)[(i + def.n) % 2]!
              : (["バッグの中身", "旅行", "推し活", "ネイル"] as const)[(i + def.n) % 4]!;
      caption = videoCaption(i + def.n, alignedTheme ?? videoTheme, category);
      thumbnailUrl = mediaUrl;
      mediaUrl = VIDEO_CLIPS[(i + def.n) % VIDEO_CLIPS.length]!;
      mediaType = "video";
    }

    const isSponsored = i % 8 === 0;
    const isBrandbridge = i % 14 === 0 || (author.accountType === "business" && i % 9 === 0);
    if (isBrandbridge) {
      productUrl = "https://www.brandbridge.jp";
      productLabel = "商品を見る";
    }

    const day = 1 + ((i * 5) % 28);
    const hour = 9 + (i % 11);
    const minute = (i * 11) % 60;

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
      createdAt: `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
    });
  }

  return posts;
}

function buildFollows(visible: Profile[]): Array<{ followerId: string; followeeId: string }> {
  const follows: Array<{ followerId: string; followeeId: string }> = [];
  const seen = new Set<string>();
  const byInterest = new Map<Interest, Profile[]>();
  for (const def of JP_PROFILES) {
    const profile = visible.find((p) => p.id === demoJpProfileId(def.n));
    if (!profile) continue;
    const list = byInterest.get(def.interest) ?? [];
    list.push(profile);
    byInterest.set(def.interest, list);
  }

  for (const def of JP_PROFILES) {
    const me = visible.find((p) => p.id === demoJpProfileId(def.n))!;
    const same = (byInterest.get(def.interest) ?? []).filter((p) => p.id !== me.id);
    const others = visible.filter((p) => p.id !== me.id && !same.some((s) => s.id === p.id));
    const targets = [...same.slice(0, 8), ...others.slice(0, 3)];
    for (const t of targets) {
      const key = `${me.id}:${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      follows.push({ followerId: me.id, followeeId: t.id });
    }
  }
  return follows;
}

function tierFor(post: Post, index: number) {
  const hot = post.category === "fashion" || post.category === "beauty";
  if (hot && index % 17 === 0) return "mega";
  if (hot && index % 7 === 0) return "hot";
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

  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i]!;
    const tier = tierFor(post, i + 1);
    const likeTarget =
      tier === "mega"
        ? pickCount(rng, 500, Math.min(750, pool.length - 1))
        : tier === "hot"
          ? pickCount(rng, 150, 420)
          : tier === "mid"
            ? pickCount(rng, 30, 140)
            : pickCount(rng, 5, 48);
    const wantTarget = Math.max(1, Math.floor(likeTarget * (tier === "mega" ? 0.35 : 0.22)));
    const saveTarget = Math.max(1, Math.floor(likeTarget * (tier === "mega" ? 0.28 : 0.18)));
    const commentTarget =
      tier === "mega"
        ? pickCount(rng, 12, 22)
        : tier === "hot"
          ? pickCount(rng, 6, 12)
          : tier === "mid"
            ? pickCount(rng, 2, 6)
            : pickCount(rng, 0, 2);

    const shuffled = [...pool];
    for (let s = shuffled.length - 1; s > 0; s -= 1) {
      const j = Math.floor(rng() * (s + 1));
      [shuffled[s], shuffled[j]] = [shuffled[j]!, shuffled[s]!];
    }

    for (let n = 0; n < likeTarget && n < shuffled.length; n += 1) {
      likes.push({ userId: shuffled[n]!.id, postId: post.id });
    }
    for (let n = 0; n < wantTarget && n < shuffled.length; n += 1) {
      wants.push({ userId: shuffled[(n + 3) % shuffled.length]!.id, postId: post.id });
    }
    for (let n = 0; n < saveTarget && n < shuffled.length; n += 1) {
      saves.push({ userId: shuffled[(n + 7) % shuffled.length]!.id, postId: post.id });
    }
    for (let n = 0; n < commentTarget; n += 1) {
      const user = shuffled[(n + 11) % shuffled.length]!;
      comments.push({
        id: demoJpCommentId(commentN),
        userId: user.id,
        postId: post.id,
        body: COMMENT_POOL[(commentN + n) % COMMENT_POOL.length]!,
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
export const SEED_JP_FOLLOWS = buildFollows(SEED_JP_PROFILES);
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
  return {
    profiles: SEED_JP_PROFILES.length,
    reactors: SEED_JP_REACTORS.length,
    posts: SEED_JP_POSTS.length,
    follows: SEED_JP_FOLLOWS.length,
    likes: SEED_JP_LIKES.length,
    wants: SEED_JP_WANTS.length,
    saves: SEED_JP_SAVES.length,
    comments: SEED_JP_COMMENTS.length,
    productUrl: SEED_JP_POSTS.filter((p) => p.productUrl).length,
    sponsored: SEED_JP_POSTS.filter((p) => p.isSponsored).length,
    brandbridge: SEED_JP_POSTS.filter((p) => p.source === "brandbridge").length,
    videos: videos.length,
    videoWithThumb: videos.filter((p) => Boolean(p.thumbnailUrl)).length,
    categories,
  };
}
