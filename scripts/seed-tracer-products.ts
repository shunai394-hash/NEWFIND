/**
 * Replace NEWFIND discovery products with TRACER store products.
 *
 * The previous discovery catalog listed third-party brand products whose
 * purchase links sent buyers to other companies' stores. This script upserts
 * the owner's own TRACER products (women's bags, hair accessories and beauty
 * accessories, sold on Shopify) as approved discovery products whose purchase
 * CTA points at the TRACER Shopify store.
 *
 *   npx tsx scripts/seed-tracer-products.ts              # dry run (default)
 *   npx tsx scripts/seed-tracer-products.ts --apply      # upsert TRACER products
 *   npx tsx scripts/seed-tracer-products.ts --apply --replace
 *        # additionally set every non-TRACER discovery product to "rejected"
 *        # (non-destructive: rows stay in the DB, they just stop showing)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (read from .env.local or the process environment).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isUsableProductImage } from "../lib/discovery/media";
import { canApprove } from "../lib/discovery/rules";
import { buildTracerSeedProducts } from "../lib/discovery/tracer-seed";

function parseEnvLocal(): Map<string, string> {
  const map = new Map<string, string>();
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function envLocal(name: string) {
  return parseEnvLocal().get(name)?.trim() || process.env[name]?.trim() || "";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const replace = process.argv.includes("--replace");
  if (replace && !apply) {
    console.error("--replace requires --apply");
    process.exit(1);
  }

  // lib/supabase/admin.ts reads process.env at call time; hydrate it from
  // .env.local before importing the db module.
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) {
      const value = envLocal(name);
      if (value) process.env[name] = value;
    }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (.env.local or environment).",
    );
    process.exit(1);
  }

  const products = await buildTracerSeedProducts();
  console.log(`Fetched ${products.length} TRACER products from the storefront.`);
  const invalid = products.filter(
    (product) => !canApprove(product) || !isUsableProductImage(product.productImageUrl),
  );
  console.log(
    `TRACER specs: ${products.length}, approvable: ${products.length - invalid.length}, invalid: ${invalid.length}`,
  );
  for (const product of invalid.slice(0, 10)) {
    console.log(`  invalid: ${product.id} ${product.productName}`);
  }
  if (invalid.length > 0) {
    console.error("Fix invalid products before applying.");
    process.exit(1);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write to Supabase.");
    return;
  }

  const { saveDiscoveryProductToDb } = await import("../lib/discovery/db");
  let saved = 0;
  let failed = 0;
  for (const product of products) {
    try {
      await saveDiscoveryProductToDb(product);
      saved += 1;
      if (saved % 50 === 0) console.log(`  saved ${saved}/${products.length}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAILED ${product.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`Upsert done: saved=${saved} failed=${failed}`);

  if (replace) {
    const { createAdminClient } = await import("../lib/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("discovery_products")
      .update({ status: "rejected" })
      .not("id", "like", "tracer-%")
      .neq("status", "rejected")
      .select("id");
    if (error) throw new Error(error.message);
    console.log(`Replace: set ${data?.length ?? 0} non-TRACER products to rejected.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
