import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const handlers = await readFile(new URL("../lib/integration/handlers.ts", import.meta.url), "utf8");
assert.equal((handlers.match(/confidence_score: confidenceScore\(payload\)/g) ?? []).length, 3,
  "insert, normal update, and duplicate-recovery paths must share the same confidence normalization");
assert.match(handlers, /function confidenceScore\(payload: Record<string, unknown>\): number \| null/);
assert.match(handlers, /return score !== null && score > 0 \? Math\.round\(score\) : null/);
console.log("TRACER confidence_score unknown/positive contract passed.");
