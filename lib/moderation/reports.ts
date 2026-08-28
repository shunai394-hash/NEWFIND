import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/discovery/alerts";

export const REPORT_REASONS = [
  { id: "spam", label: "spam" },
  { id: "harassment", label: "harassment" },
  { id: "hate", label: "hate" },
  { id: "nudity", label: "nudity" },
  { id: "illegal", label: "illegal" },
  { id: "other", label: "other" },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

const REASON_LABELS: Record<ReportReasonId, string> = {
  spam: "\u30B9\u30D1\u30E0",
  harassment: "\u5ACC\u304C\u3089\u305B\u30FB\u8B3C\u8B17\u4E2D\u50B7",
  hate: "\u30D8\u30A4\u30C8\u30FB\u5DEE\u5225",
  nudity: "\u4E0D\u9069\u5207\u306A\u6027\u7684\u30B3\u30F3\u30C6\u30F3\u30C4",
  illegal: "\u9055\u6CD5\u307E\u305F\u306F\u5371\u967A\u306A\u5185\u5BB9",
  other: "\u305D\u306E\u4ED6",
};

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /content_reports|schema cache|42P01/i.test(message);
}

export function reportReasonLabel(id: ReportReasonId) {
  return REASON_LABELS[id];
}

export async function submitReport(input: {
  reporterId: string;
  targetUserId?: string | null;
  postId?: string | null;
  reason: ReportReasonId;
  detail?: string;
}) {
  const reason = REPORT_REASONS.find((item) => item.id === input.reason);
  if (!reason) throw new Error("invalid reason");
  if (!input.targetUserId && !input.postId) {
    throw new Error("missing target");
  }

  const db = createAdminClient();
  const { error } = await db.from("content_reports").insert({
    reporter_id: input.reporterId,
    target_user_id: input.targetUserId ?? null,
    post_id: input.postId ?? null,
    reason: input.reason,
    detail: (input.detail ?? "").trim().slice(0, 1000),
  });
  if (error && !missingTable(error)) throw new Error(error.message);

  const { data: admins } = await db.from("profiles").select("id").eq("is_admin", true);
  const label = [
    REASON_LABELS[input.reason],
    input.postId ? `post ${input.postId}` : null,
    input.targetUserId ? `user ${input.targetUserId}` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  for (const admin of admins ?? []) {
    await createNotification({
      userId: (admin as { id: string }).id,
      type: "report",
      title: "content report",
      body: label,
      postId: input.postId ?? null,
    });
  }

  await createNotification({
    userId: input.reporterId,
    type: "report_received",
    title: "report received",
    body: "We received your report and will review it.",
    postId: input.postId ?? null,
  });

  return { ok: true as const };
}
