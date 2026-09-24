import { createAdminClient } from "@/lib/supabase/admin";

export type ExternalPostContentType =
  | "discovery"
  | "product_discovery"
  | "ai_news"
  | "future_technology"
  | "world_signal"
  | "correspondent_report";

export type ExternalPostPayload = {
  postId: string;
  authorId: string;
  caption: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  category: string;
  productUrl: string | null;
  productLabel: string | null;
  source: string;
  sourceRef: string | null;
  sourceUrl: string | null;
  residentName: string | null;
  contentType: ExternalPostContentType;
};

function createExternalPostEventId(postId: string) {
  return `newfind-external-post:${postId}`;
}

export async function enqueueExternalPost(input: {
  postId: string;
  authorId: string;
  caption: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  category?: string | null;
  productUrl?: string | null;
  productLabel?: string | null;
  source?: string | null;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  residentName?: string | null;
  contentType?: ExternalPostContentType;
}) {
  const supabase = createAdminClient();

  const eventId = createExternalPostEventId(input.postId);

  const payload: ExternalPostPayload = {
    postId: input.postId,
    authorId: input.authorId,
    caption: input.caption.trim(),
    mediaUrl: input.mediaUrl?.trim() || null,
    thumbnailUrl: input.thumbnailUrl?.trim() || null,
    category: input.category?.trim() || "other",
    productUrl: input.productUrl?.trim() || null,
    productLabel: input.productLabel?.trim() || null,
    source: input.source?.trim() || "newfind_ai",
    sourceRef: input.sourceRef?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    residentName: input.residentName?.trim() || null,
    contentType: input.contentType || "discovery",
  };

  const { data, error } = await supabase
    .from("external_post_outbox")
    .upsert(
      {
        post_id: input.postId,
        event_id: eventId,
        source: payload.source,
        content_type: payload.contentType,
        payload,
        status: "pending",
        attempts: 0,
        next_retry_at: new Date().toISOString(),
        last_error: null,
        published_at: null,
      },
      {
        onConflict: "post_id",
        ignoreDuplicates: false,
      },
    )
    .select("id, event_id, post_id, status")
    .single();

  if (error) {
    throw new Error(
      `External post outbox enqueue failed: ${error.message}`,
    );
  }

  return {
    queued: true,
    outboxId: data.id,
    eventId: data.event_id,
    postId: data.post_id,
    status: data.status,
  };
}
