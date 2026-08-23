/**
 * Download JP catalog images and upload to Supabase public media bucket.
 * Rewrites lib/seed-jp-images.ts URLs to stable supabase.co public URLs.
 *
 *   npx tsx scripts/prepare-jp-images.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  JP_BEAUTY_IMAGES,
  JP_FASHION_IMAGES,
  JP_FOOD_IMAGES,
  JP_HOME_IMAGES,
  JP_LIFESTYLE_IMAGES,
  JP_OTHER_IMAGES,
  JP_TECH_IMAGES,
  JP_TRAVEL_IMAGES,
  type JpImageAsset,
} from "../lib/seed-jp-images";

const OUT_DIR = resolve("tmp/jp-images");
const GENERATED = resolve("lib/seed-jp-images.ts");

const POOLS: Array<{ name: string; assets: JpImageAsset[] }> = [
  { name: "JP_FASHION_IMAGES", assets: JP_FASHION_IMAGES },
  { name: "JP_BEAUTY_IMAGES", assets: JP_BEAUTY_IMAGES },
  { name: "JP_FOOD_IMAGES", assets: JP_FOOD_IMAGES },
  { name: "JP_LIFESTYLE_IMAGES", assets: JP_LIFESTYLE_IMAGES },
  { name: "JP_TRAVEL_IMAGES", assets: JP_TRAVEL_IMAGES },
  { name: "JP_TECH_IMAGES", assets: JP_TECH_IMAGES },
  { name: "JP_HOME_IMAGES", assets: JP_HOME_IMAGES },
  { name: "JP_OTHER_IMAGES", assets: JP_OTHER_IMAGES },
];

function loadEnv() {
  const map = new Map<string, string>();
  const path = resolve(".env.local");
  if (!existsSync(path)) throw new Error("missing .env.local");
  for (const raw of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(line.slice(0, eq).trim(), value);
  }
  return map;
}

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function extFromUrl(url: string, contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (url.includes(".png")) return "png";
  if (url.includes(".webp")) return "webp";
  return "jpg";
}

async function download(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "NEWFIND-jp-image-prep/1.0",
      // Force JPEG/PNG — AVIF breaks some Android WebViews / older browsers.
      Accept: "image/jpeg,image/png,image/webp;q=0.8,*/*;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 2000) throw new Error(`too small ${url}`);
  return { buf, contentType: res.headers.get("content-type") };
}

function serializeAsset(a: JpImageAsset) {
  const place = a.place ? `, place: ${JSON.stringify(a.place)}` : "";
  return `  { id: ${JSON.stringify(a.id)}, url: ${JSON.stringify(a.url)}, theme: ${JSON.stringify(a.theme)}, note: ${JSON.stringify(a.note)}${place} },`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnv();
  const supabaseUrl = env.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !key) throw new Error("missing supabase env");

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hostedPools: Array<{ name: string; assets: JpImageAsset[] }> = [];
  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (const pool of POOLS) {
    const next: JpImageAsset[] = [];
    for (const asset of pool.assets) {
      // Already hosted on this project's storage — keep.
      if (asset.url.includes(`${new URL(supabaseUrl).hostname}/storage/v1/object/public/media/`)) {
        next.push(asset);
        skipped += 1;
        continue;
      }

      const sid = safeId(asset.id);
      try {
        const { buf, contentType } = await download(asset.url);
        const ext = extFromUrl(asset.url, contentType);
        const objectPath = `demo-jp-img/${sid}.${ext}`;
        const localPath = resolve(OUT_DIR, `${sid}.${ext}`);
        writeFileSync(localPath, buf);

        const { error } = await admin.storage.from("media").upload(objectPath, buf, {
          contentType: contentType || `image/${ext === "jpg" ? "jpeg" : ext}`,
          upsert: true,
        });
        if (error) throw new Error(error.message);

        const { data } = admin.storage.from("media").getPublicUrl(objectPath);
        next.push({ ...asset, url: data.publicUrl });
        ok += 1;
        if (ok % 25 === 0) console.log(`uploaded ${ok} (fail=${fail} skip=${skipped})`);
      } catch (e) {
        fail += 1;
        console.warn(`FAIL ${asset.id}: ${e instanceof Error ? e.message : e}`);
        // Keep original URL as fallback so seed still has an image field.
        next.push(asset);
      }
    }
    hostedPools.push({ name: pool.name, assets: next });
  }

  const hostedCount = hostedPools
    .flatMap((p) => p.assets)
    .filter((a) => a.url.includes("/storage/v1/object/public/media/")).length;

  if (hostedCount < 400) {
    throw new Error(`too few hosted images: ${hostedCount}`);
  }

  const body = `/** Auto-generated by scripts/prepare-jp-images.ts — unique JP feed images (Supabase-hosted). */
export type JpImageAsset = {
  id: string;
  url: string;
  theme: string;
  note: string;
  place?: string;
};

${hostedPools
  .map((p) => `export const ${p.name}: JpImageAsset[] = [\n${p.assets.map(serializeAsset).join("\n")}\n];`)
  .join("\n\n")}

export const JP_IMAGES_BY_CATEGORY = {
  fashion: JP_FASHION_IMAGES,
  beauty: JP_BEAUTY_IMAGES,
  food: JP_FOOD_IMAGES,
  lifestyle: JP_LIFESTYLE_IMAGES,
  travel: JP_TRAVEL_IMAGES,
  tech: JP_TECH_IMAGES,
  home: JP_HOME_IMAGES,
  other: JP_OTHER_IMAGES,
} as const;

export function assertJpImageUniqueness() {
  const seen = new Set<string>();
  for (const list of Object.values(JP_IMAGES_BY_CATEGORY)) {
    for (const asset of list) {
      if (seen.has(asset.url)) {
        throw new Error(\`Duplicate JP image URL in catalog: \${asset.url}\`);
      }
      seen.add(asset.url);
    }
  }
}
`;

  writeFileSync(GENERATED, body);
  console.log(`\nwrote ${GENERATED}`);
  console.log(`uploaded=${ok} failedKeepOriginal=${fail} alreadyHosted=${skipped} hostedTotal=${hostedCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
