/**
 * Append ?v=jpeg1 cache-buster to hosted JP image URLs in seed + DB posts
 * so browsers stop serving cached AVIF responses.
 *
 *   npx tsx scripts/bust-jp-image-cache.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEED_JP_POSTS } from "../lib/seed-jp";

const BUST = "v=jpeg1";

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

function withBust(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("/storage/v1/object/public/media/demo-jp-img/")) return url;
  if (url.includes(BUST)) return url;
  return url.includes("?") ? `${url}&${BUST}` : `${url}?${BUST}`;
}

async function main() {
  // Rewrite seed-jp-images.ts URLs in place
  const imagesPath = resolve("lib/seed-jp-images.ts");
  let src = readFileSync(imagesPath, "utf8");
  src = src.replace(
    /(https:\/\/[^"']+\/storage\/v1\/object\/public\/media\/demo-jp-img\/[^"'?]+(?:\.(?:jpg|jpeg|png|webp)))(?:\?[^"']*)?/g,
    (_m, base: string) => `${base}?${BUST}`,
  );
  writeFileSync(imagesPath, src);
  console.log("updated lib/seed-jp-images.ts");

  const env = loadEnv();
  const admin = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let updated = 0;
  for (let i = 0; i < SEED_JP_POSTS.length; i += 40) {
    const slice = SEED_JP_POSTS.slice(i, i + 40);
    const { data, error } = await admin
      .from("posts")
      .select("id,media_url,thumbnail_url")
      .in(
        "id",
        slice.map((p) => p.id),
      );
    if (error) throw error;
    for (const row of data ?? []) {
      const mediaUrl = withBust(row.media_url);
      const thumbnailUrl = withBust(row.thumbnail_url);
      if (mediaUrl === row.media_url && thumbnailUrl === row.thumbnail_url) continue;
      const { error: upErr } = await admin
        .from("posts")
        .update({ media_url: mediaUrl, thumbnail_url: thumbnailUrl })
        .eq("id", row.id);
      if (upErr) throw upErr;
      updated += 1;
    }
  }
  console.log(JSON.stringify({ postsTouched: SEED_JP_POSTS.length, updated }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
