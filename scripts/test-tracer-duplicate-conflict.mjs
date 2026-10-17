import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isDuplicateKeyConflict } from "../lib/integration/duplicate-conflict.ts";

assert.equal(isDuplicateKeyConflict({ code: "23505", message: "duplicate key" }), true);
assert.equal(isDuplicateKeyConflict({ message: 'duplicate key value violates unique constraint "discovery_products_duplicate_key_uidx"' }), true);
assert.equal(isDuplicateKeyConflict({ code: "23503", message: "foreign key violation" }), false);
assert.equal(isDuplicateKeyConflict({ message: "network timeout" }), false);
assert.equal(isDuplicateKeyConflict(null), false);

const handlers = await readFile(new URL("../lib/integration/handlers.ts", import.meta.url), "utf8");
assert.match(handlers, /isDuplicateKeyConflict\(insert\.error\)/);
assert.doesNotMatch(handlers, /if \(!isDuplicateKeyConflict\(insert\.error\)\)\s*\{\s*return \{ ok: false, detail: `discovery insert failed:/, "identity recovery must run even when PostgREST's error wrapper is not recognized");
assert.match(handlers, /const raced = await admin[\s\S]*\.eq\("duplicate_key", identity\)/, "insert failures must re-read exact duplicate identity before returning failure");
assert.match(handlers, /discovery insert failed without matching identity or URL/, "unmatched insert failures must remain explicit failures");
assert.match(handlers, /discovery duplicate URL recovery failed/);
console.log("TRACER duplicate-key recovery contract passed");
