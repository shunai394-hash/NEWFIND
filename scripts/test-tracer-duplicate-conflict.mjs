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
assert.match(handlers, /discovery duplicate URL recovery failed/);
console.log("TRACER duplicate-key recovery contract passed");
