import { NextResponse } from "next/server";
import { loadWorldDiscoveryReport } from "@/lib/ai/control-tower/world-report";
import { loadRecentInvestigations } from "@/lib/ai/investigations";
import { curateWorldHeadlines } from "@/lib/ai/control-tower/world-headline-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [report, investigations] = await Promise.all([
    loadWorldDiscoveryReport(),
    loadRecentInvestigations(8),
  ]);

  const investigationHeadlines = investigations.map((item) => ({
    actor: item.correspondentTitle || "特派員",
    beat: item.beat || item.city || "",
    kind: item.sourceKind || "",
    dispatch: item.status,
    title: item.summary || item.title,
    status: item.status,
    sourceUrl: item.sourceUrl,
    sourceTitle: item.sourceTitle,
    confidence: item.confidence,
    evidenceCount: item.evidenceCount,
  }));

  // Keep the public world pulse distinct and evidence-shaped: never surface
  // synthetic "Trend signal" aggregates, expired investigations, or duplicates.
  const headlines = curateWorldHeadlines(
    [...investigationHeadlines, ...report.headlines],
    8,
  );

  return NextResponse.json({
    reportAvailable: report.available,
    residents: report.residents,
    posts: report.posts,
    products: report.products,
    news: report.news,
    investigations: investigations.length,
    headlines,
  });
}
