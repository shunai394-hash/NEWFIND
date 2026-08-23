/**
 * Verify all JP photo/thumbnail URLs: GET OK + real JPEG magic + unique.
 *   npx tsx scripts/verify-jp-media-jpeg.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEED_JP_POSTS } from "../lib/seed-jp";

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

function isJpeg(buf: Buffer) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

async function checkImage(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 NEWFIND-verify",
      Accept: "image/jpeg,image/png,image/*,*/*;q=0.8",
      Referer: "https://newfind-self.vercel.app/",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  return {
    ok: res.ok && isJpeg(buf) && buf.length > 1500 && ct.includes("jpeg"),
    status: res.status,
    ct,
    bytes: buf.length,
    jpeg: isJpeg(buf),
  };
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = SEED_JP_POSTS.map((p) => p.id);
  const rows: Array<{ id: string; media_type: string; media_url: string | null; thumbnail_url: string | null }> =
    [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data, error } = await admin
      .from("posts")
      .select("id,media_type,media_url,thumbnail_url")
      .in("id", ids.slice(i, i + 80));
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  const photoUrls = [
    ...new Set(
      rows
        .filter((r) => r.media_type === "photo")
        .map((r) => r.media_url)
        .filter((u): u is string => Boolean(u)),
    ),
  ];
  const thumbUrls = [
    ...new Set(
      rows
        .filter((r) => r.media_type === "video")
        .map((r) => r.thumbnail_url)
        .filter((u): u is string => Boolean(u)),
    ),
  ];

  const bad: Array<{ url: string; kind: string; detail: unknown }> = [];
  for (const [kind, urls] of [
    ["photo", photoUrls],
    ["thumb", thumbUrls],
  ] as const) {
    let i = 0;
    for (const url of urls) {
      i += 1;
      const detail = await checkImage(url);
      if (!detail.ok) bad.push({ url, kind, detail });
      if (i % 50 === 0) console.log(`${kind} ${i}/${urls.length} bad=${bad.filter((b) => b.kind === kind).length}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        posts: rows.length,
        photos: photoUrls.length,
        uniquePhotos: photoUrls.length,
        thumbs: thumbUrls.length,
        photoDupes: photoUrls.length - new Set(photoUrls).size,
        httpOrFormatBad: bad.length,
        sampleBad: bad.slice(0, 10),
      },
      null,
      2,
    ),
  );
  if (bad.length > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
