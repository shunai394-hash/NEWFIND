/**
 * Seed verified Japan products (MUJI / SHISEIDO) into discovery_products.
 * Only registers SKUs whose official page returns a usable product image.
 *
 *   npx tsx scripts/seed-japan-products.ts
 *   npx tsx scripts/seed-japan-products.ts --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { isUsableProductImage } from "../lib/discovery/media";
import {
  JAPAN_SEED_SPECS,
  japanSeedProduct,
} from "../lib/discovery/japan-seed";
import { saveDiscoveryProductToDb } from "../lib/discovery/db";
import { canApprove } from "../lib/discovery/rules";

function parseEnvLocal(): Map<string, string> {
  const map = new Map<string, string>();
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
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

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function absUrl(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function extractOgImage(html: string, pageUrl: string) {
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /property=["']og:image:url["'][^>]*content=["']([^"']+)["']/i,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = absUrl(match[1].replace(/&amp;/g, "&"), pageUrl);
      if (url.startsWith("https://")) return url;
    }
  }
  return null;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status, html: "" };
    const html = await response.text();
    return { ok: true, status: response.status, html };
  } catch {
    return { ok: false, status: 0, html: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function imageLooksReal(url: string) {
  if (!isUsableProductImage(url)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": UA, accept: "image/*,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const type = (response.headers.get("content-type") || "").toLowerCase();
    try {
      await response.body?.cancel();
    } catch {
      /* ignore */
    }
    if (type.includes("text/html")) return false;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function mujiImageCandidates(jan: string) {
  return [
    `https://www.muji.com/public/media/img/item/${jan}_org.jpg`,
    `https://www.muji.com/public/media/img/item/${jan}.jpg`,
    `https://www.muji.com/public/media/img/item/${jan}_400.jpg`,
    `https://www.muji.com/public/media/img/item/${jan}_99_400.jpg`,
    `https://img.muji.net/img/item/${jan}.jpg`,
  ];
}

async function resolveImage(officialUrl: string, sku: string, brand: string) {
  if (brand === "MUJI") {
    for (const candidate of mujiImageCandidates(sku)) {
      if (await imageLooksReal(candidate)) return candidate;
    }
  }
  const page = await fetchText(officialUrl);
  if (page.ok) {
    const og = extractOgImage(page.html, officialUrl);
    if (og && (await imageLooksReal(og))) return og;
  }
  if (brand !== "MUJI") {
    for (const candidate of mujiImageCandidates(sku)) {
      if (await imageLooksReal(candidate)) return candidate;
    }
  }
  return null;
}

async function applyMigration054(url: string, key: string) {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/054_product_saves_alerts.sql"),
    "utf8",
  );
  const projectRef = new URL(url).hostname.split(".")[0];
  const tokenPath = resolve(process.env.USERPROFILE || process.env.HOME || "", ".supabase", "access-token");
  const token = existsSync(tokenPath) ? readFileSync(tokenPath, "utf8").trim() : "";
  if (token && projectRef) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (response.ok) {
      console.log("054 applied via Management API");
      return true;
    }
    const text = await response.text();
    console.log("Management API:", response.status, text.slice(0, 400));
  }

  const meta = await fetch(`${url.replace(/\/$/, "")}/pg/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (meta.ok) {
    console.log("054 applied via postgres-meta");
    return true;
  }

  // Split into statements and try RPC if a helper exists.
  const { error } = await createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).rpc("exec_sql", { sql });
  if (!error) {
    console.log("054 applied via exec_sql");
    return true;
  }
  console.log("Could not auto-apply 054 via API. Tables will be created if SQL was already applied.");
  return false;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = envLocal("NEXT_PUBLIC_SUPABASE_URL");
  const key = envLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;

  if (apply) {
    await applyMigration054(url, key);
  }

  const results: Array<{ id: string; ok: boolean; reason: string }> = [];
  for (const spec of JAPAN_SEED_SPECS) {
    const known = spec.imageUrl && (await imageLooksReal(spec.imageUrl)) ? spec.imageUrl : null;
    const image = known || (await resolveImage(spec.officialUrl, spec.sku, spec.brand));
    if (!image) {
      results.push({ id: spec.id, ok: false, reason: "no official product image" });
      console.log("SKIP", spec.productName);
      continue;
    }
    const product = japanSeedProduct(spec, image);
    if (!canApprove(product)) {
      results.push({ id: spec.id, ok: false, reason: "canApprove failed after image resolve" });
      console.log("SKIP approve", spec.productName);
      continue;
    }
    if (!apply) {
      results.push({ id: spec.id, ok: true, reason: `dry-run image=${image}` });
      console.log("OK", spec.productName, image);
      continue;
    }
    try {
      await saveDiscoveryProductToDb(product);
      results.push({ id: spec.id, ok: true, reason: image });
      console.log("SAVED", spec.productName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: spec.id, ok: false, reason: message });
      console.log("FAIL", spec.productName, message);
    }
  }

  const saved = results.filter((item) => item.ok);
  console.log(JSON.stringify({ apply, total: JAPAN_SEED_SPECS.length, saved: saved.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
