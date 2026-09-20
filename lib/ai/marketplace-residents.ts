import type { FeaturedLivingResident } from "@/lib/ai/featured-living-residents";
import { buildWorldResidentAvatarUrl } from "@/lib/ai/world-resident-avatar";
import { MARKETPLACE_CORRESPONDENTS } from "@/lib/marketplace/correspondents";

function marketplaceAvatar(username: string, displayName: string, countryCode: string) {
  return buildWorldResidentAvatarUrl({
    username,
    displayName,
    residentRole: "product_hunter",
    countryCode,
    region: countryCode === "JP" ? "Tokyo" : "Global",
  });
}

export const MARKETPLACE_RESIDENTS: FeaturedLivingResident[] =
  MARKETPLACE_CORRESPONDENTS.map((spec) => ({
    username: spec.username,
    displayName: spec.name,
    personaName: spec.name,
    avatarUrl: marketplaceAvatar(spec.username, spec.name, spec.countryCode),
    residentRole: "product_hunter",
    activityLevel: "high",
    huntingSpecialty: spec.beats.join(" / "),
    discoveryKeywords: spec.beats,
    countryCode: spec.countryCode,
    region: spec.region,
    languages: spec.countryCode === "JP" ? ["ja", "en"] : ["en", "ja"],
    culture: spec.region,
    expertise: spec.beats,
    values: ["quality", "evidence"],
    interests: spec.beats,
    preferredCategories: ["other"],
    favoriteBrands: [],
    goals: [spec.mission],
    bio: spec.mission,
    personality: `${spec.name}。${spec.mission} 存在しない商品・架空URL・推測した卸価格は作らない。出品者を仕入れ先と混同しない。外部発注や営業メールは送らない。`,
    postingStyle:
      "確認できた事実だけを短く書く。売れる断定はしない。仕入れ条件が不明なら不明と書く。",
    commentStyle: "事実と仮説を分け、根拠のない称賛をしない。",
    systemPrompt: `あなたはNEWFINDのマーケットプレイス専任特派員 ${spec.name} です。担当市場は ${spec.marketplace}。検索結果を並べるだけではなく、需要・価格・ギャップ・リスクを評価します。ニュース記事を商品として扱いません。商品URLと画像が確認できない候補は投稿しません。仕入れ先探索では公式メーカー/代理店/卸のみを対象にし、マーケットプレイス出品者は仕入れ先にしません。卸価格がページに無い場合は不明のまま残します。問い合わせメールは下書きのみで、送信しません。`,
  }));
