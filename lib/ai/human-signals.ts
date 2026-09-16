import { createAdminClient } from "@/lib/supabase/admin";

export type ResidentHumanSignals = {
  posts: number;
  likes: number;
  comments: number;
  saves: number;
  productSaves: number;
  likeRate: number;
  saveRate: number;
  commentRate: number;
  discoverySuccess: number;
};

function rate(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export async function loadResidentHumanSignals(input: {
  profileId: string;
  discoveryProductIds?: string[];
}): Promise<ResidentHumanSignals> {
  const admin = createAdminClient();
  const empty: ResidentHumanSignals = {
    posts: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    productSaves: 0,
    likeRate: 0,
    saveRate: 0,
    commentRate: 0,
    discoverySuccess: 0,
  };

  const { data: posts, error: postsError } = await admin
    .from("posts")
    .select("id")
    .eq("author_id", input.profileId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (postsError) {
    console.error("human signals posts failed", postsError.message);
    return empty;
  }
  const postIds = (posts ?? []).map((row) => row.id);
  if (postIds.length === 0) return empty;

  const [likes, comments, saves, productSaves] = await Promise.all([
    admin.from("likes").select("post_id").in("post_id", postIds),
    admin.from("comments").select("post_id").in("post_id", postIds),
    admin.from("saves").select("post_id").in("post_id", postIds),
    input.discoveryProductIds?.length
      ? admin
          .from("discovery_product_saves")
          .select("product_id")
          .in("product_id", input.discoveryProductIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (likes.error) console.error("human signals likes", likes.error.message);
  if (comments.error) {
    console.error("human signals comments", comments.error.message);
  }
  if (saves.error) console.error("human signals saves", saves.error.message);

  const likeCount = likes.data?.length ?? 0;
  const commentCount = comments.data?.length ?? 0;
  const saveCount = saves.data?.length ?? 0;
  const productSaveCount = productSaves.data?.length ?? 0;
  const discoverySuccess = Math.min(
    100,
    likeCount * 4 + commentCount * 8 + saveCount * 10 + productSaveCount * 12,
  );

  return {
    posts: postIds.length,
    likes: likeCount,
    comments: commentCount,
    saves: saveCount,
    productSaves: productSaveCount,
    likeRate: rate(likeCount, postIds.length),
    saveRate: rate(saveCount, postIds.length),
    commentRate: rate(commentCount, postIds.length),
    discoverySuccess,
  };
}

export function signalsToMemoryLine(signals: ResidentHumanSignals) {
  if (signals.posts === 0) {
    return "人間の反応はまだ少ない。次はより具体的で珍しい発見を優先する。";
  }
  if (signals.discoverySuccess >= 40) {
    return `最近の発見は人間に反応されている (like ${signals.likeRate}% / save ${signals.saveRate}% / comment ${signals.commentRate}%)。同じ型の探索を深掘りしてよい。`;
  }
  return `最近の発見は反応が薄い (like ${signals.likeRate}% / save ${signals.saveRate}%)。既出カテゴリを避け、別の切り口を探す。`;
}
