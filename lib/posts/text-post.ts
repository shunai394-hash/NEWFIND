import type { CategoryId, CreatePostInput, MediaType, Post } from "@/lib/types";
import { isCategoryId } from "@/lib/categories";
import {
  hasDisplayablePostMedia,
  isAiPersonDiscoveryMedia,
} from "@/lib/products/discovery-filter";

export function trimCaption(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeMediaUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export function normalizePostMedia(input: {
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
}): { mediaType: MediaType; mediaUrl: string | null } {
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);
  if (!mediaUrl) {
    return { mediaType: "text", mediaUrl: null };
  }

  return {
    mediaType: input.mediaType === "video" ? "video" : "photo",
    mediaUrl,
  };
}

export function requirePostCaption(value: string | null | undefined): string {
  const caption = trimCaption(value);
  if (!caption) {
    throw new Error("本文を入力してください");
  }
  return caption;
}

export function isVisibleTimelinePost(
  post: Pick<Post, "mediaUrl" | "thumbnailUrl" | "mediaType" | "caption">,
): boolean {
  const media = normalizeMediaUrl(post.mediaUrl);
  const thumb = normalizeMediaUrl(post.thumbnailUrl);
  if (isAiPersonDiscoveryMedia(media) || isAiPersonDiscoveryMedia(thumb)) {
    return false;
  }
  if (hasDisplayablePostMedia(post)) return true;
  return Boolean(trimCaption(post.caption));
}

export function tweetCategory(
  values: Array<string | null | undefined> | undefined,
): CategoryId {
  for (const value of values ?? []) {
    const candidate = (value ?? "").trim();
    if (candidate && isCategoryId(candidate)) return candidate;
  }
  return "lifestyle";
}

export function buildCreatePostPayload(
  authorId: string,
  input: CreatePostInput,
): Record<string, unknown> {
  const caption = requirePostCaption(input.caption);
  const media = normalizePostMedia({
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
  });

  const payload: Record<string, unknown> = {
    author_id: authorId,
    media_type: media.mediaType,
    media_url: media.mediaUrl,
    thumbnail_url: input.thumbnailUrl?.trim() || media.mediaUrl,
    caption,
    category: input.category,
    product_url: input.productUrl?.trim() || null,
    product_label: input.productLabel?.trim() || null,
    is_sponsored: Boolean(input.isSponsored),
    source: input.source ?? "user",
    source_ref: input.sourceRef || null,
    source_url: input.sourceUrl || null,
  };

  if (media.mediaType === "text") {
    payload.thumbnail_url = input.thumbnailUrl?.trim() || null;
  }

  if (input.japanContext) payload.japan_context = input.japanContext;
  if (input.visualKind) payload.visual_kind = input.visualKind;
  if (input.featuredPerson) payload.featured_person = input.featuredPerson;
  if (input.featuredCredit) payload.featured_credit = input.featuredCredit;
  if (input.discoveryProductId) {
    payload.discovery_product_id = input.discoveryProductId;
  }

  return payload;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shouldAttemptFallbackTweet(input: {
  activityLevel?: string | null;
  seed: string;
  hasProductSubject: boolean;
}): boolean {
  if (input.hasProductSubject) return false;
  const roll = hashSeed(input.seed) % 10;
  if (input.activityLevel === "high") return roll < 5;
  if (input.activityLevel === "low") return roll < 2;
  return roll < 4;
}
