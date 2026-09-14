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
  spam: "スパム",
  harassment: "嫌がらせ・誹謗中傷",
  hate: "ヘイト・差別",
  nudity: "不適切な性的コンテンツ",
  illegal: "違法または危険な内容",
  other: "その他",
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

  if (error && !missingTable(error)) {
    throw new Error(error.message);
  }

  const { data: admins } = await db
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  const label = [
    REASON_LABELS[input.reason],
    input.postId ? `post ${input.postId}` : null,
    input.targetUserId ? `user ${input.targetUserId}` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  for (const admin of admins ?? []) {
    try {
      await createNotification({
        userId: (admin as { id: string }).id,
        type: "report",
        title: "content report",
        body: label,
        postId: input.postId ?? null,
      });
    } catch (error) {
      console.error("REPORT_ADMIN_NOTIFICATION_FAILED", error);
    }
  }

  try {
    await createNotification({
      userId: input.reporterId,
      type: "report_received",
      title: "report received",
      body: "We received your report and will review it.",
      postId: input.postId ?? null,
    });
  } catch (error) {
    console.error("REPORT_RECEIPT_NOTIFICATION_FAILED", error);
  }

  return { ok: true as const };
}
