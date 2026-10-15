import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/integration/tracer-promotion.ts", import.meta.url), "utf8");

assert.match(source, /function isMissingPromotionLedger/);
assert.match(source, /if \(isMissingPromotionLedger\(existing\.error\)\) \{[\s\S]*?publishPromotionWithoutLedger/,
  "missing promotion ledger must fall back to the durable inbox plus AI feed instead of rejecting every product");
assert.match(source, /\.from\("ai_posts"\)[\s\S]*?\.eq\("product_url", input\.productUrl\)[\s\S]*?\.eq\("status", "published"\)/,
  "fallback publishing must check for an existing published post before creating another");
assert.match(source, /if \(isMissingPromotionLedger\(error\)\) \{[\s\S]*?\.from\("ai_posts"\)[\s\S]*?\.update\(\{ status: "hidden" \}\)/,
  "withdrawal must still hide feed posts when the optional ledger is absent");
assert.match(source, /promotion published to AI resident feed \(ledger fallback\)/);
console.log("TRACER promotion ledger fallback checks passed.");

assert.match(source, /resolvePromotionPersona/);
assert.match(source, /ai_personas/);
assert.match(source, /no active AI resident is available to publish this promotion/);

const handlerSource = await readFile(new URL("../lib/integration/handlers.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/integrations/tracer/route.ts", import.meta.url), "utf8");
assert.match(handlerSource, /productId,\s*detail: assigned/);
assert.match(routeSource, /typeof result\.productId === "string"/,
  "promotion processing must use the product ID returned by intake, even when duplicate-key matching retained an older URL");
