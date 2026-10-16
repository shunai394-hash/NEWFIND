import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const handlers = await readFile(new URL("../lib/integration/handlers.ts", import.meta.url), "utf8");
assert.equal((handlers.match(/confidence_score: Math\.round\(/g) ?? []).length, 3,
  "insert, normal update, and duplicate-recovery paths must round confidence_score before writing the integer column");
console.log("TRACER confidence_score integer contract passed.");
