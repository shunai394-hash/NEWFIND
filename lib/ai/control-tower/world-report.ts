import { createAdminClient } from "@/lib/supabase/admin";

export type WorldDiscoveryReport = {
  residents: number;
  searches: number;
  scanned: number;
  accepted: number;
  dropped: number;
  posts: number;
  products: number;
  news: number;
  trends: number;
  duplicates: number;
  qualityNg: number;
  headlines: Array<{
    actor: string;
    beat: string;
    kind: string;
    dispatch: string;
    title: string;
  }>;
};

function startOfUtcDay(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export async function loadWorldDiscoveryReport(): Promise<WorldDiscoveryReport> {
  const empty: WorldDiscoveryReport = {
    residents: 0,
    searches: 0,
    scanned: 0,
    accepted: 0,
    dropped: 0,
    posts: 0,
    products: 0,
    news: 0,
    trends: 0,
    duplicates: 0,
    qualityNg: 0,
    headlines: [],
  };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_activity_logs")
      .select("persona_id, actor_name, action, detail, metadata, occurred_at")
      .gte("occurred_at", startOfUtcDay())
      .order("occurred_at", { ascending: false })
      .limit(400);
    if (error || !data) return empty;

    const residents = new Set<string>();
    const report = { ...empty, headlines: [] as WorldDiscoveryReport["headlines"] };
    for (const row of data) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (row.persona_id) residents.add(String(row.persona_id));
      if (row.action === "search" || meta.world === true) report.searches += 1;
      if (meta.world === true) {
        report.scanned += Number(meta.scanned ?? 0);
        report.accepted += Number(meta.accepted ?? 0);
        report.dropped += Number(meta.dropped ?? 0);
        const kind = String(meta.infoKind ?? "");
        if (kind === "PRODUCT") report.products += 1;
        if (kind === "NEWS") report.news += 1;
        if (kind === "TREND") report.trends += 1;
        if (row.action === "posted" || row.action === "ai_decision") {
          report.headlines.push({
            actor: String(row.actor_name ?? "resident"),
            beat: String(meta.beat ?? ""),
            kind,
            dispatch: String(meta.dispatchKind ?? ""),
            title: String(meta.title ?? row.detail ?? "").slice(0, 120),
          });
        }
      }
      if (row.action === "posted") report.posts += 1;
      if (/duplicate/i.test(String(row.detail ?? ""))) report.duplicates += 1;
      if (/QUALITY|WEAK_SOURCE|LOW_EVIDENCE/i.test(String(row.detail ?? ""))) {
        report.qualityNg += 1;
      }
    }
    report.residents = residents.size;
    report.headlines = report.headlines.slice(0, 12);
    return report;
  } catch {
    return empty;
  }
}
