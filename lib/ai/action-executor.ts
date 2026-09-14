import type { AIAction } from "./brain";
import { createAdminClient } from "@/lib/supabase/admin";
import { listDiscoveryProductsFromDb, saveDiscoveryProductToDb } from "@/lib/discovery/db";
import { findDuplicate, prepareDiscoveryProduct, canonicalProductUrl } from "@/lib/discovery/rules";
import { normalizePostMedia } from "@/lib/posts/text-post";
import type {
  DiscoveryCategory,
  DiscoveryProductInput,
  TrendTag,
} from "@/lib/discovery/types";

const DISCOVERY_CATEGORIES = new Set([
  "fashion",
  "beauty",
  "accessories",
  "fragrance",
  "japan_brand",
  "celebrity_style",
  "anime_culture",
  "lifestyle",
  "food",
  "travel",
  "home",
  "tech",
  "sports",
  "other",
]);

const TREND_TAGS = new Set([
  "celebrity_pick",
  "viral",
  "trending",
  "rising",
  "new_release",
  "best_seller",
  "gen_z_trend",
  "world_trend",
  "japan_trend",
  "us_trend",
  "korea_trend",
  "uk_trend",
  "re_discovered",
  "editorial_pick",
  "hidden_gem",
  "luxury",
  "teen",
  "high_school",
  "y2k",
  "streetwear",
]);

function safeCategory(value: string): DiscoveryCategory {
  return DISCOVERY_CATEGORIES.has(value)
    ? (value as DiscoveryCategory)
    : "other";
}

function safeTrendTags(values: string[]): TrendTag[] {
  return values.filter((value) => TREND_TAGS.has(value)) as TrendTag[];
}

function safeScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeProductUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

export async function executeAIAction(
  action: AIAction,
  userId: string,
) {
  switch (action.type) {
    case "LIKE": {
      const supabase = createAdminClient();

      const { data: existing, error: lookupError } = await supabase
        .from("likes")
        .select("user_id")
        .eq("user_id", userId)
        .eq("post_id", action.postId)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      if (existing) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", userId)
          .eq("post_id", action.postId);

        if (error) {
          throw new Error(error.message);
        }

        return {
          executed: true,
          action,
          result: { liked: false },
        };
      }

      const { error } = await supabase
        .from("likes")
        .insert({
          user_id: userId,
          post_id: action.postId,
        });

      if (error) {
        throw new Error(error.message);
      }

      return {
        executed: true,
        action,
        result: { liked: true },
      };
    }

    case "COMMENT": {
      const supabase = createAdminClient();

      const { data: comment, error } = await supabase
        .from("comments")
        .insert({
          post_id: action.postId,
          user_id: userId,
          body: action.text.trim(),
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        executed: true,
        action,
        result: { comment },
      };
    }

    case "POST": {
      const supabase = createAdminClient();
      const caption = action.caption.trim();
      const media = normalizePostMedia({
        mediaUrl: action.mediaUrl,
        mediaType: "photo",
      });
      const productUrl = action.productUrl?.trim() || "";
      const sourceRef =
        action.sourceRef?.trim() ||
        action.discoveryProductId?.trim() ||
        "";
      if (!caption) {
        return {
          executed: false,
          action,
          result: { reason: "empty caption" },
        };
      }

      const payload: Record<string, unknown> = {
        author_id: userId,
        media_type: media.mediaType,
        media_url: media.mediaUrl,
        thumbnail_url: media.mediaUrl,
        caption,
        category: safeCategory(action.category || "other"),
        product_url: productUrl || null,
        product_label: action.productLabel?.trim() || null,
        is_sponsored: false,
        source: "ai",
        source_ref: sourceRef || null,
        source_url: action.sourceUrl?.trim() || action.productUrl?.trim() || null,
      };

      if (action.discoveryProductId?.trim()) {
        payload.discovery_product_id = action.discoveryProductId.trim();
      }

      let { data: post, error } = await supabase
        .from("posts")
        .insert(payload)
        .select("*")
        .single();

      if (
        error &&
        /discovery_product_id|schema cache|42703/i.test(error.message)
      ) {
        delete payload.discovery_product_id;
        const retry = await supabase
          .from("posts")
          .insert(payload)
          .select("*")
          .single();
        post = retry.data;
        error = retry.error;
      }

      if (error || !post) {
        throw new Error(error?.message || "AI post insert failed");
      }

      return {
        executed: true,
        action,
        result: { post },
      };
    }

    case "FOLLOW": {
      const supabase = createAdminClient();

      if (action.profileId === userId) {
        throw new Error("AI cannot follow itself");
      }

      const { data: existing, error: lookupError } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("followee_id", action.profileId)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      if (existing) {
        return {
          executed: true,
          action,
          result: {
            following: true,
            alreadyFollowing: true,
          },
        };
      }

      const { error } = await supabase
        .from("follows")
        .insert({
          follower_id: userId,
          followee_id: action.profileId,
        });

      if (error) {
        throw new Error(error.message);
      }

      return {
        executed: true,
        action,
        result: {
          following: true,
        },
      };
    }

    case "SAVE": {
      const supabase = createAdminClient();

      const { data: existing, error: lookupError } = await supabase
        .from("saves")
        .select("user_id")
        .eq("user_id", userId)
        .eq("post_id", action.postId)
        .maybeSingle();

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      if (existing) {
        return {
          executed: true,
          action,
          result: { saved: true, alreadySaved: true },
        };
      }

      const { error } = await supabase.from("saves").insert({
        user_id: userId,
        post_id: action.postId,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        executed: true,
        action,
        result: { saved: true },
      };
    }

    case "REPLY": {
      const supabase = createAdminClient();

      const { data: parent, error: parentError } = await supabase
        .from("comments")
        .select("id, post_id")
        .eq("id", action.parentCommentId)
        .eq("post_id", action.postId)
        .maybeSingle();

      if (parentError) {
        throw new Error(parentError.message);
      }

      if (!parent) {
        return {
          executed: false,
          action,
          result: { reason: "parent comment not found" },
        };
      }

      const { data: comment, error } = await supabase
        .from("comments")
        .insert({
          post_id: action.postId,
          user_id: userId,
          body: action.text.trim(),
          parent_comment_id: action.parentCommentId,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        executed: true,
        action,
        result: { comment },
      };
    }

    case "DISCOVER_PRODUCT": {
      const supabase = createAdminClient();
      const productUrl = action.productUrl.trim();

      if (!productUrl || !isValidHttpUrl(productUrl)) {
        return {
          executed: false,
          action,
          result: { reason: "invalid product url" },
        };
      }

      const { data: targetPost, error: postError } = await supabase
        .from("posts")
        .select("id, product_url")
        .eq("id", action.postId)
        .maybeSingle();

      if (postError) {
        throw new Error(postError.message);
      }

      const postProductUrl = String(targetPost?.product_url ?? "").trim();
      if (!postProductUrl || !isValidHttpUrl(postProductUrl)) {
        return {
          executed: false,
          action,
          result: { reason: "post has no product url" },
        };
      }

      if (normalizeProductUrl(postProductUrl) !== normalizeProductUrl(productUrl)) {
        return {
          executed: false,
          action,
          result: { reason: "product url not on target post" },
        };
      }

      const { data: personaRow } = await supabase
        .from("ai_personas")
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle();

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const input: DiscoveryProductInput = {
        id,
        brand: action.brand.trim(),
        productName: action.productName.trim(),
        category: safeCategory(action.category),
        subcategory: action.subcategory?.trim() || "",
        country: action.country?.trim() || null,
        description: action.description?.trim() || "",
        productImageUrl: null,
        productUrl: postProductUrl,
        officialUrl:
          action.officialUrl &&
          isValidHttpUrl(action.officialUrl.trim()) &&
          normalizeProductUrl(action.officialUrl.trim()) ===
            normalizeProductUrl(postProductUrl)
            ? action.officialUrl.trim()
            : null,
        price:
          typeof action.price === "number" && Number.isFinite(action.price)
            ? action.price
            : null,
        currency: action.currency?.trim() || "USD",
        sku: null,
        trendScore: safeScore(action.trendScore),
        confidenceScore: safeScore(action.confidenceScore),
        discoverySource: "ai",
        discoveredByResidentId: personaRow?.id ?? null,
        discoveredAt: now,
        attentionReason: action.attentionReason?.trim() || "",
        status: "pending",
        trendTags: safeTrendTags(action.trendTags ?? []),
        sources: [
          {
            id: crypto.randomUUID(),
            sourceType: "sns",
            sourceUrl: postProductUrl,
            sourceTitle: action.productName.trim(),
            sourceDomain: null,
            publishedAt: null,
            sourceExcerpt: action.description?.trim() || null,
            verificationStatus: "unverified",
            sourceTier: 4,
            createdAt: now,
          },
        ],
        people: [],
        sales: [],
      };

      const prepared = prepareDiscoveryProduct(input);
      const existingProducts = await listDiscoveryProductsFromDb({
        admin: true,
        status: "all",
      });
      const duplicate = findDuplicate(prepared, existingProducts);
      if (duplicate) {
        return {
          executed: true,
          action,
          result: {
            discoveryProductId: duplicate.id,
            status: duplicate.status,
            duplicate: true,
          },
        };
      }

      const product = await saveDiscoveryProductToDb(prepared);

      return {
        executed: true,
        action,
        result: {
          discoveryProductId: product.id,
          status: product.status,
        },
      };
    }

    case "IGNORE":
      return {
        executed: true,
        action,
      };
  }
}

export type AIProductPostInput = {
  discoveryProductId: string;
  brand: string;
  productName: string;
  category: string;
  productUrl: string;
  productImageUrl?: string | null;
  description?: string | null;
  residentName?: string | null;
  attentionReason?: string | null;
  caption?: string | null;
};

async function findExistingAiProductPost(input: {
  discoveryProductId: string;
  productUrl: string;
}) {
  const supabase = createAdminClient();
  const productUrl = input.productUrl.trim();
  const canonical = canonicalProductUrl(productUrl);

  const { data: byDiscovery, error: lookupError } = await supabase
    .from("posts")
    .select("id, author_id, product_url")
    .eq("source", "ai")
    .eq("discovery_product_id", input.discoveryProductId)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    if (/discovery_product_id|schema cache|42703/i.test(lookupError.message)) {
      const { data: legacyExisting, error: legacyLookupError } = await supabase
        .from("posts")
        .select("id, author_id, product_url")
        .eq("source", "ai")
        .eq("source_ref", input.discoveryProductId)
        .limit(1)
        .maybeSingle();
      if (legacyLookupError) throw new Error(legacyLookupError.message);
      if (legacyExisting) return legacyExisting;
    } else {
      throw new Error(lookupError.message);
    }
  } else if (byDiscovery) {
    return byDiscovery;
  }

  if (productUrl) {
    const { data: byUrl, error: urlError } = await supabase
      .from("posts")
      .select("id, author_id, product_url")
      .eq("source", "ai")
      .eq("product_url", productUrl)
      .limit(1)
      .maybeSingle();
    if (urlError) throw new Error(urlError.message);
    if (byUrl) return byUrl;
  }

  if (canonical) {
    const { data: recent, error: recentError } = await supabase
      .from("posts")
      .select("id, author_id, product_url")
      .eq("source", "ai")
      .not("product_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(400);
    if (recentError) throw new Error(recentError.message);
    const match = (recent ?? []).find(
      (row) => canonicalProductUrl(String(row.product_url ?? "")) === canonical,
    );
    if (match) return match;
  }

  return null;
}

export async function publishAIProductPost(
  userId: string,
  input: AIProductPostInput,
) {
  const supabase = createAdminClient();

  /*
   * AI product posts are globally unique per discovery product AND
   * canonical product URL. Multiple hunters must not post the same item.
   */
  const existing = await findExistingAiProductPost({
    discoveryProductId: input.discoveryProductId,
    productUrl: input.productUrl,
  });

  if (existing) {
    return {
      executed: true,
      alreadyPublished: true,
      postId: existing.id,
    };
  }

  const description = input.description?.trim() || "";
  const attentionReason = input.attentionReason?.trim() || "";
  const residentCaption = input.caption?.trim() || "";

  const captionParts = [
    input.productName.trim(),
    input.brand.trim() ? `by ${input.brand.trim()}` : "",
    description,
    attentionReason,
  ].filter(Boolean);

  const payload: Record<string, unknown> = {
    author_id: userId,
    media_type: "photo",
    media_url: input.productImageUrl?.trim() || null,
    thumbnail_url: input.productImageUrl?.trim() || null,
    caption: residentCaption || captionParts.join("\n\n"),
    category: safeCategory(input.category),
    product_url: input.productUrl.trim(),
    product_label: input.productName.trim(),
    is_sponsored: false,
    source: "ai",
    source_ref: input.discoveryProductId,
    source_url: input.productUrl.trim(),
    discovery_product_id: input.discoveryProductId,
  };

  let { data: post, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single();

  if (
    error &&
    /discovery_product_id|schema cache|42703/i.test(error.message)
  ) {
    delete payload.discovery_product_id;

    const retry = await supabase
      .from("posts")
      .insert(payload)
      .select("*")
      .single();

    post = retry.data;
    error = retry.error;
  }

  if (error || !post) {
    throw new Error(error?.message || "AI product post insert failed");
  }

  return {
    executed: true,
    alreadyPublished: false,
    postId: post.id,
    post,
  };
}
