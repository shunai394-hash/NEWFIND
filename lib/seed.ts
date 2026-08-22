import type { Comment, Post, Profile } from "@/lib/types";

export const SEED_PROFILES: Profile[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    username: "mei_finds",
    displayName: "Mei",
    bio: "日常で見つけた、ちょっと良いもの。",
    avatarUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
    companyName: null,
    companyWebsite: null,
    companyDescription: null,
    createdAt: "2026-08-01T09:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    username: "kaito.lab",
    displayName: "Kaito",
    bio: "デスク周りと小さなガジェットが好き。",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "personal",
    companyName: null,
    companyWebsite: null,
    companyDescription: null,
    createdAt: "2026-08-02T09:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    username: "nordic_home",
    displayName: "Nordic Home",
    bio: "北欧の暮らしの道具。",
    avatarUrl:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "Nordic Home",
    companyWebsite: "https://www.muji.com/",
    companyDescription: "暮らしの道具を紹介するブランドアカウント。",
    createdAt: "2026-08-03T09:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    username: "glowlab",
    displayName: "GLOW LAB",
    bio: "スキンケアと朝の光。",
    avatarUrl:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&h=200&q=80",
    accountType: "business",
    companyName: "GLOW LAB",
    companyWebsite: "https://www.brandbridge.jp",
    companyDescription: "BrandBridge掲載ブランドの公式アカウント。",
    createdAt: "2026-08-04T09:00:00.000Z",
  },
];

export const SEED_POSTS: Post[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    authorId: "11111111-1111-4111-8111-111111111111",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "洗ったあとの落ち感が好きな白T。毎日これでいい。",
    category: "fashion",
    productUrl: "https://www.muji.com/",
    productLabel: "商品を見る",
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-20T02:10:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    authorId: "22222222-2222-4222-8222-222222222222",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "作業用ノート。ファンの音が小さくて集中できる。",
    category: "tech",
    productUrl: "https://www.apple.com/",
    productLabel: "商品を見る",
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-20T06:40:00.000Z",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    authorId: "33333333-3333-4333-8333-333333333333",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "午後の光が合うソファ。週末はこの角度で。",
    category: "home",
    productUrl: "https://www.ikea.com/",
    productLabel: "商品を見る",
    isSponsored: true,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-21T01:20:00.000Z",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    authorId: "44444444-4444-4444-8444-444444444444",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "朝いちの保湿。公式ページから詳細を確認できます。",
    category: "beauty",
    productUrl: "https://www.brandbridge.jp",
    productLabel: "商品を見る",
    isSponsored: true,
    source: "brandbridge",
    sourceRef: "glow-serum-01",
    sourceUrl: "https://www.brandbridge.jp",
    createdAt: "2026-08-21T08:00:00.000Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    authorId: "11111111-1111-4111-8111-111111111111",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "近所の焙煎。このカップがちょうどいい大きさ。",
    category: "food",
    productUrl: "https://www.starbucks.co.jp/",
    productLabel: "商品を見る",
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-21T11:15:00.000Z",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    authorId: "22222222-2222-4222-8222-222222222222",
    mediaType: "video",
    mediaUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517649763962-0c623066027b?auto=format&fit=crop&w=1200&q=80",
    caption: "週末のラン。軽くて沈まないシューズ。",
    category: "sports",
    productUrl: "https://www.nike.com/",
    productLabel: "商品を見る",
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-22T00:30:00.000Z",
  },
  {
    id: "12121212-1212-4121-8121-121212121212",
    authorId: "33333333-3333-4333-8333-333333333333",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "窓辺のグリーン。鉢の質感が部屋を落ち着かせる。",
    category: "lifestyle",
    productUrl: null,
    productLabel: null,
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-22T03:45:00.000Z",
  },
  {
    id: "34343434-3434-4343-8343-343434343434",
    authorId: "44444444-4444-4444-8444-444444444444",
    mediaType: "photo",
    mediaUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: null,
    caption: "リップの発色だけ見に来て、結局これになった。",
    category: "beauty",
    productUrl: "https://www.sephora.com/",
    productLabel: "商品を見る",
    isSponsored: false,
    source: "user",
    sourceRef: null,
    sourceUrl: null,
    createdAt: "2026-08-22T05:20:00.000Z",
  },
];

export const SEED_FOLLOWS: Array<{ followerId: string; followeeId: string }> = [
  {
    followerId: "11111111-1111-4111-8111-111111111111",
    followeeId: "33333333-3333-4333-8333-333333333333",
  },
  {
    followerId: "11111111-1111-4111-8111-111111111111",
    followeeId: "44444444-4444-4444-8444-444444444444",
  },
  {
    followerId: "22222222-2222-4222-8222-222222222222",
    followeeId: "11111111-1111-4111-8111-111111111111",
  },
  {
    followerId: "22222222-2222-4222-8222-222222222222",
    followeeId: "33333333-3333-4333-8333-333333333333",
  },
];

export const SEED_LIKES: Array<{ userId: string; postId: string }> = [
  { userId: "22222222-2222-4222-8222-222222222222", postId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  { userId: "33333333-3333-4333-8333-333333333333", postId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  { userId: "11111111-1111-4111-8111-111111111111", postId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  { userId: "22222222-2222-4222-8222-222222222222", postId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  { userId: "11111111-1111-4111-8111-111111111111", postId: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
];

export const SEED_WANTS: Array<{ userId: string; postId: string }> = [
  { userId: "11111111-1111-4111-8111-111111111111", postId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
  { userId: "22222222-2222-4222-8222-222222222222", postId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  { userId: "33333333-3333-4333-8333-333333333333", postId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
];

export const SEED_SAVES: Array<{ userId: string; postId: string }> = [
  { userId: "22222222-2222-4222-8222-222222222222", postId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  { userId: "11111111-1111-4111-8111-111111111111", postId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
];

export const SEED_COMMENTS: Comment[] = [
  {
    id: "c0000001-0000-4000-8000-000000000001",
    userId: "22222222-2222-4222-8222-222222222222",
    postId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    body: "これ欲しい。生地感わかります？",
    createdAt: "2026-08-20T03:00:00.000Z",
  },
  {
    id: "c0000002-0000-4000-8000-000000000002",
    userId: "11111111-1111-4111-8111-111111111111",
    postId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    body: "色が部屋に合いそう。",
    createdAt: "2026-08-21T02:00:00.000Z",
  },
];
