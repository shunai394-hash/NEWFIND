import type { AIAction } from "./brain";
import { supabaseStore } from "@/lib/store/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveDiscoveryProductToDb } from "@/lib/discovery/db";
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

export async function executeAIAction(
  action: AIAction,
  userId: string,
) {
  switch (action.type) {
    case "LIKE": {
      const liked = await supabaseStore.toggleLike(action.postId, userId);

      return {
        executed: true,
        action,
        result: { liked },
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

      const payload = {
        author_id: userId,
        media_type: "photo",
        media_url:
          "https://images.unsplash.com/photo-1483985988355-763728e1935b",
        thumbnail_url: null,
        caption: action.caption,
        category: "fashion",
        product_url: null,
        product_label: null,
        is_sponsored: false,
        source: "user",
        source_ref: null,
        source_url: null,
      };

      const { data: post, error } = await supabase
        .from("posts")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
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

    case "DISCOVER_PRODUCT": {
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
        productUrl: action.productUrl.trim(),
        officialUrl: action.officialUrl?.trim() || null,
        price:
          typeof action.price === "number" && Number.isFinite(action.price)
            ? action.price
            : null,
        currency: action.currency?.trim() || "USD",
        sku: null,
        trendScore: safeScore(action.trendScore),
        confidenceScore: safeScore(action.confidenceScore),
        discoverySource: "ai",
        discoveredAt: now,
        attentionReason: action.attentionReason?.trim() || "",
        status: "pending",
        trendTags: safeTrendTags(action.trendTags ?? []),
        sources: [
          {
            id: crypto.randomUUID(),
            sourceType: "sns",
            sourceUrl: action.productUrl.trim(),
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

      const product = await saveDiscoveryProductToDb(input);

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
