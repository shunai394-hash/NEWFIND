import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const handlers = await readFile(new URL("../lib/integration/handlers.ts", import.meta.url), "utf8");
assert.equal((handlers.match(/confidence_score: confidenceScore\(payload\)/g) ?? []).length, 3,
  "insert, normal update, and duplicate-recovery paths must share the same confidence normalization");
assert.match(handlers, /function confidenceScore\(payload: Record<string, unknown>\): number/);
assert.match(handlers, /selectionScore !== null && selectionScore > 0/);
assert.match(handlers, /confidence <= 1 \? confidence \* 100 : confidence/);
assert.match(handlers, /return 0;/);
console.log("TRACER confidence_score unknown/positive contract passed.");
