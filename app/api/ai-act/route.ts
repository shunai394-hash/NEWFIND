import { createAiActHandler } from "@/lib/ai/ai-act-handler";
import { executeAiEngine } from "@/lib/ai/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const handle = createAiActHandler({
  cronSecret: () => process.env.CRON_SECRET,
  execute: executeAiEngine,
});

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
