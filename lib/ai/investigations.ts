import { createAdminClient } from "@/lib/supabase/admin";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";
import {
  investigationHeadline,
  nextInvestigationStatus,
  type InvestigationStatus,
} from "@/lib/ai/investigation-status";
import type { ResidentChoice } from "@/lib/ai/self-model";
import { worldInfoKey } from "@/lib/ai/correspondent";

export type InvestigationRecord = {
  id: string;
  personaId: string;
  profileId: string | null;
  status: InvestigationStatus;
  title: string;
  summary: string | null;
  beat: string | null;
  city: string | null;
  correspondentTitle: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceKind: string | null;
  entityKey: string | null;
  productId: string | null;
  postId: string | null;
  commentId: string | null;
  evidenceCount: number;
  confidence: number;
  nextAction: string | null;
  metadata: Record<string, unknown>;
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type InvestigationUpsertInput = {
  personaId: string;
  profileId?: string | null;
  actorName: string;
  actorRole: string;
  title: string;
  summary?: string | null;
  beat?: string | null;
  city?: string | null;
  correspondentTitle?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceKind?: string | null;
  entityKey?: string | null;
  productId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  evidenceCount?: number;
  confidence?: number;
  decision: ResidentChoice;
  qualityOk: boolean;
  qualityReason?: string;
  known?: boolean;
  runId?: string | null;
  dryRun?: boolean;
};

function mapRow(row: Record<string, unknown>): InvestigationRecord {
  return {
    id: String(row.id),
    personaId: String(row.persona_id),
    profileId: (row.profile_id as string | null) ?? null,
    status: row.status as InvestigationStatus,
    title: String(row.title ?? ""),
    summary: (row.summary as string | null) ?? null,
    beat: (row.beat as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    correspondentTitle: (row.correspondent_title as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceTitle: (row.source_title as string | null) ?? null,
    sourceKind: (row.source_kind as string | null) ?? null,
    entityKey: (row.entity_key as string | null) ?? null,
    productId: (row.product_id as string | null) ?? null,
    postId: (row.post_id as string | null) ?? null,
    commentId: (row.comment_id as string | null) ?? null,
    evidenceCount: Number(row.evidence_count ?? 0),
    confidence: Number(row.confidence ?? 0),
    nextAction: (row.next_action as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    openedAt: String(row.opened_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    closedAt: (row.closed_at as string | null) ?? null,
  };
}

function entityKeyOf(input: InvestigationUpsertInput) {
  if (input.entityKey) return input.entityKey;
  if (input.sourceUrl || input.title) {
    return worldInfoKey(input.sourceUrl || "", input.title);
  }
  return null;
}

function ageDays(openedAt: string | null | undefined) {
  if (!openedAt) return 0;
  const parsed = Date.parse(openedAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, (Date.now() - parsed) / 86400000);
}

export async function loadOpenInvestigations(
  personaId: string,
): Promise<InvestigationRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_investigations")
      .select("*")
      .eq("persona_id", personaId)
      .in("status", ["DISCOVERY", "INVESTIGATING"])
      .order("updated_at", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

/**
 * Open investigations tied to a real comment (opened by the INVESTIGATE
 * action in action-executor.ts) that this persona should try to resolve
 * with a real search pass and a grounded reply. A cooldown keeps the same
 * question from being re-attempted every cycle -- only once it's had a
 * chance to actually find new evidence.
 */
export async function loadPendingCommentInvestigations(
  personaId: string,
  cooldownHours = 4,
): Promise<InvestigationRecord[]> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - cooldownHours * 3600000).toISOString();
    const { data, error } = await admin
      .from("ai_investigations")
      .select("*")
      .eq("persona_id", personaId)
      .in("status", ["DISCOVERY", "INVESTIGATING"])
      .not("comment_id", "is", null)
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(3);
    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function loadInvestigationsForProfile(
  profileId: string,
  limit = 6,
): Promise<InvestigationRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_investigations")
      .select("*")
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function loadVerifiedUnposted(
  personaId: string,
): Promise<InvestigationRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_investigations")
      .select("*")
      .eq("persona_id", personaId)
      .eq("status", "VERIFIED")
      .is("post_id", null)
      .order("updated_at", { ascending: false })
      .limit(4);
    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function loadRecentInvestigations(
  limit = 12,
): Promise<InvestigationRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_investigations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function expireStaleInvestigations(personaId: string) {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    await admin
      .from("ai_investigations")
      .update({
        status: "EXPIRED",
        next_action: "drop stale lead",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("persona_id", personaId)
      .in("status", ["DISCOVERY", "INVESTIGATING"])
      .lt("opened_at", cutoff);
  } catch (error) {
    console.warn("expire investigations skipped", error);
  }
}

export async function markInvestigationPosted(input: {
  id: string;
  postId?: string | null;
  commentId?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin
      .from("ai_investigations")
      .update({
        post_id: input.postId ?? null,
        comment_id: input.commentId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
  } catch (error) {
    console.warn("mark investigation posted failed", error);
  }
}

export async function upsertInvestigation(
  input: InvestigationUpsertInput,
): Promise<{
  record: InvestigationRecord | null;
  status: InvestigationStatus;
  shouldPost: boolean;
  nextAction: string;
}> {
  const key = entityKeyOf(input);
  const evidenceCount = Math.max(1, input.evidenceCount ?? 1);
  let previous: InvestigationRecord | null = null;

  try {
    const admin = createAdminClient();
    if (key) {
      const { data } = await admin
        .from("ai_investigations")
        .select("*")
        .eq("persona_id", input.personaId)
        .eq("entity_key", key)
        .in("status", ["DISCOVERY", "INVESTIGATING"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) previous = mapRow(data as Record<string, unknown>);
    }

    const advance = nextInvestigationStatus({
      decision: input.decision,
      previous: previous?.status ?? null,
      evidenceCount: (previous?.evidenceCount ?? 0) + evidenceCount,
      scoresTotal: input.confidence ?? 0,
      qualityOk: input.qualityOk,
      qualityReason: input.qualityReason,
      known: input.known,
      ageDays: ageDays(previous?.openedAt),
    });

    if (input.dryRun) {
      return {
        record: previous,
        status: advance.status,
        shouldPost: advance.shouldPost,
        nextAction: advance.nextAction,
      };
    }

    const closed =
      advance.status === "VERIFIED" ||
      advance.status === "REJECTED" ||
      advance.status === "EXPIRED";
    const now = new Date().toISOString();
    const payload = {
      persona_id: input.personaId,
      profile_id: input.profileId ?? previous?.profileId ?? null,
      status: advance.status,
      title: input.title.slice(0, 180),
      summary: (input.summary || investigationHeadline(advance.status, input.title)).slice(
        0,
        400,
      ),
      beat: input.beat ?? previous?.beat ?? null,
      city: input.city ?? previous?.city ?? null,
      correspondent_title:
        input.correspondentTitle ?? previous?.correspondentTitle ?? null,
      source_url: input.sourceUrl ?? previous?.sourceUrl ?? null,
      source_title: input.sourceTitle ?? previous?.sourceTitle ?? input.title,
      source_kind: input.sourceKind ?? previous?.sourceKind ?? null,
      entity_key: key,
      product_id: input.productId ?? previous?.productId ?? null,
      post_id: input.postId ?? previous?.postId ?? null,
      comment_id: input.commentId ?? previous?.commentId ?? null,
      evidence_count: (previous?.evidenceCount ?? 0) + evidenceCount,
      confidence: input.confidence ?? previous?.confidence ?? 0,
      next_action: advance.nextAction,
      metadata: {
        ...(previous?.metadata ?? {}),
        decision: input.decision,
        qualityReason: input.qualityReason ?? null,
      },
      updated_at: now,
      closed_at: closed ? now : null,
    };

    let saved: Record<string, unknown> | null = null;
    if (previous) {
      const { data, error } = await admin
        .from("ai_investigations")
        .update(payload)
        .eq("id", previous.id)
        .select("*")
        .single();
      if (error) throw error;
      saved = data as Record<string, unknown>;
    } else {
      const { data, error } = await admin
        .from("ai_investigations")
        .insert({ ...payload, opened_at: now })
        .select("*")
        .single();
      if (error) throw error;
      saved = data as Record<string, unknown>;
    }

    const record = saved ? mapRow(saved) : null;
    await logAiActivity({
      personaId: input.personaId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: "investigation",
      detail: `${advance.status} ${input.title}`.slice(0, 180),
      relatedProductId: input.productId ?? null,
      relatedRunId: input.runId ?? null,
      metadata: {
        world: true,
        investigation: true,
        status: advance.status,
        shouldPost: advance.shouldPost,
        nextAction: advance.nextAction,
        title: input.title,
        url: input.sourceUrl,
        beat: input.beat,
        city: input.city,
        correspondentTitle: input.correspondentTitle,
        infoKind: input.sourceKind,
      },
    });

    return {
      record,
      status: advance.status,
      shouldPost: advance.shouldPost,
      nextAction: advance.nextAction,
    };
  } catch (error) {
    console.warn("upsert investigation skipped", error);
    const fallback = nextInvestigationStatus({
      decision: input.decision,
      previous: previous?.status ?? null,
      evidenceCount,
      scoresTotal: input.confidence ?? 0,
      qualityOk: input.qualityOk,
      qualityReason: input.qualityReason,
      known: input.known,
    });
    // Persistence failure is not a successful investigation result.
    // Never let a computed VERIFIED/shouldPost decision escape when the
    // database write did not actually succeed; otherwise the resident can
    // publish an unpersisted investigation repeatedly on later patrols.
    return {
      record: previous,
      status: previous?.status ?? "DISCOVERY",
      shouldPost: false,
      nextAction: "retry persistence",
    };
  }
}
