/**
 * Convert demo-jp-img objects that are AVIF/WebP (but named .jpg) into real JPEG.
 * Overwrites the same storage paths so seed URLs stay valid.
 *
 *   npx tsx scripts/convert-jp-images-to-jpeg.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const OUT = resolve("tmp/jp-images-jpeg");

function loadEnv() {
  const map = new Map<string, string>();
  for (const raw of readFileSync(resolve(".env.local"), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
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

function sniff(buf: Buffer) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
    if (brand.startsWith("heic") || brand.startsWith("mif1")) return "heic";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buf.length >= 8 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  return "unknown";
}

async function listAll(
  admin: ReturnType<typeof createClient>,
  prefix: string,
): Promise<string[]> {
  const names: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from("media").list(prefix, {
      limit: 100,
      offset,
    });
    if (error) throw error;
    const batch = (data ?? []).filter((f) => f.name && !f.name.endsWith("/"));
    for (const f of batch) names.push(`${prefix}/${f.name}`);
    if (batch.length < 100) break;
    offset += batch.length;
  }
  return names;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const url = env.get("NEXT_PUBLIC_SUPABASE_URL")!;
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const paths = await listAll(admin, "demo-jp-img");
  console.log(`files=${paths.length}`);

  let converted = 0;
  let alreadyJpeg = 0;
  let failed = 0;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const publicUrl = `${url}/storage/v1/object/public/media/${path}`;
    try {
      const res = await fetch(publicUrl, {
        headers: { "User-Agent": "NEWFIND-jpeg-convert/1.0", Accept: "*/*" },
      });
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const input = Buffer.from(await res.arrayBuffer());
      const kind = sniff(input);
      if (kind === "jpeg") {
        alreadyJpeg += 1;
        continue;
      }

      const jpeg = await sharp(input).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      if (jpeg.byteLength < 1500) throw new Error("jpeg too small");
      writeFileSync(resolve(OUT, path.split("/").pop()!), jpeg);

      const { error } = await admin.storage.from("media").upload(path, jpeg, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw new Error(error.message);
      converted += 1;
      if (converted % 25 === 0 || i === paths.length - 1) {
        console.log(
          `progress ${i + 1}/${paths.length} converted=${converted} jpeg=${alreadyJpeg} fail=${failed} last=${kind}`,
        );
      }
    } catch (e) {
      failed += 1;
      console.warn(`FAIL ${path}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(JSON.stringify({ paths: paths.length, converted, alreadyJpeg, failed }, null, 2));
  if (failed > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
