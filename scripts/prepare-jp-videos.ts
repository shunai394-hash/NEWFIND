/**
 * Build themed JP demo MP4s (video + audio) and upload to Supabase public media bucket.
 *
 * Usage:
 *   npx tsx scripts/prepare-jp-videos.ts
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FF =
  "C:\\Users\\shuro\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin";
const FFMPEG = resolve(FF, "ffmpeg.exe");
const FFPROBE = resolve(FF, "ffprobe.exe");

const OUT_DIR = resolve("tmp/jp-videos");
const GENERATED = resolve("lib/seed-jp-videos.generated.ts");

type Theme =
  | "コーデ紹介"
  | "今日の服"
  | "ルックブック"
  | "GRWM"
  | "メイク"
  | "コスメ購入品"
  | "ネイル"
  | "バッグの中身"
  | "カフェ"
  | "スイーツ"
  | "旅行"
  | "推し活";

type Source = { theme: Theme; id: string };

/** Mixkit silent clips mapped to JP demo themes. Audio is muxed from public MP4s below. */
const SOURCES: Source[] = [
  { theme: "メイク", id: "43575" },
  { theme: "GRWM", id: "34572" },
  { theme: "コーデ紹介", id: "34563" },
  { theme: "今日の服", id: "34487" },
  { theme: "ルックブック", id: "39876" },
  { theme: "コスメ購入品", id: "32458" },
  { theme: "ネイル", id: "1171" },
  { theme: "バッグの中身", id: "4303" },
  { theme: "カフェ", id: "1199" },
  { theme: "カフェ", id: "432" },
  { theme: "旅行", id: "3247" },
  { theme: "旅行", id: "25155" },
  { theme: "推し活", id: "41566" },
  { theme: "コーデ紹介", id: "42214" },
  { theme: "今日の服", id: "4613" },
  { theme: "メイク", id: "34566" },
  { theme: "バッグの中身", id: "4013" },
  { theme: "ルックブック", id: "5084" },
  { theme: "推し活", id: "25154" },
  { theme: "スイーツ", id: "1199" },
];

/** Public MP4s known to contain audio tracks — used as BGM sources for mux. */
const AUDIO_DONORS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://videos.pexels.com/video-files/855281/855281-hd_1920_1080_25fps.mp4",
  "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
];

/** Already-audio public clips used as-is (theme-aligned). */
const EXTERNAL_AUDIO = [
  {
    theme: "カフェ" as Theme,
    url: "https://videos.pexels.com/video-files/855281/855281-hd_1920_1080_25fps.mp4",
  },
  {
    theme: "旅行" as Theme,
    url: "https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4",
  },
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

async function download(url: string, dest: string) {
  if (existsSync(dest) && readFileSync(dest).byteLength > 20_000) return;
  const res = await fetch(url, {
    headers: { "User-Agent": "NEWFIND-jp-video-prep/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 10_000) throw new Error(`too small ${url}`);
  writeFileSync(dest, buf);
}

function hasAudio(file: string) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return (r.stdout || "").includes("audio");
}

function mux(video: string, audio: string, out: string) {
  const r = spawnSync(
    FFMPEG,
    [
      "-y",
      "-i",
      video,
      "-stream_loop",
      "-1",
      "-i",
      audio,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      "-movflags",
      "+faststart",
      out,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${(r.stderr || r.stdout || "").slice(-400)}`);
  }
  if (!hasAudio(out)) throw new Error(`no audio after mux: ${out}`);
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

  const clips: Array<{ theme: Theme; url: string; hasAudio: true }> = [];

  const audioPaths: string[] = [];
  for (let i = 0; i < AUDIO_DONORS.length; i += 1) {
    const donorUrl = AUDIO_DONORS[i]!;
    const donorPath = resolve(OUT_DIR, `donor-${i}.mp4`);
    const audioPath = resolve(OUT_DIR, `donor-${i}.aac`);
    console.log(`extract audio donor ${i}`);
    await download(donorUrl, donorPath);
    const ar = spawnSync(
      FFMPEG,
      ["-y", "-i", donorPath, "-vn", "-acodec", "aac", "-b:a", "128k", audioPath],
      { encoding: "utf8" },
    );
    if (ar.status !== 0 || !existsSync(audioPath)) {
      throw new Error(`audio extract failed donor ${i}: ${(ar.stderr || "").slice(-300)}`);
    }
    audioPaths.push(audioPath);
  }

  for (const ext of EXTERNAL_AUDIO) {
    console.log(`external ${ext.theme}`);
    const probe = spawnSync(
      FFPROBE,
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        ext.url,
      ],
      { encoding: "utf8", timeout: 60000 },
    );
    const out = probe.stdout || "";
    if (!out.includes("video") || !out.includes("audio")) {
      throw new Error(`external missing streams: ${ext.url} => ${out}`);
    }
    clips.push({ theme: ext.theme, url: ext.url, hasAudio: true });
  }

  const seenIds = new Set<string>();
  for (const [index, src] of SOURCES.entries()) {
    if (seenIds.has(`${src.theme}-${src.id}`)) continue;
    seenIds.add(`${src.theme}-${src.id}`);
    const videoUrl = `https://assets.mixkit.co/videos/${src.id}/${src.id}-720.mp4`;
    const videoPath = resolve(OUT_DIR, `${src.id}.mp4`);
    const outPath = resolve(OUT_DIR, `${src.id}-${src.theme}-with-audio.mp4`);
    const themeSlug: Record<Theme, string> = {
      コーデ紹介: "coordinate",
      今日の服: "outfit",
      ルックブック: "lookbook",
      GRWM: "grwm",
      メイク: "makeup",
      コスメ購入品: "cosmetics",
      ネイル: "nails",
      バッグの中身: "bag",
      カフェ: "cafe",
      スイーツ: "sweets",
      旅行: "travel",
      推し活: "oshi",
    };
    const objectPath = `demo-jp/${themeSlug[src.theme]}-${src.id}.mp4`;
    const musicPath = audioPaths[index % audioPaths.length]!;

    console.log(`prepare ${src.theme} ${src.id}`);
    try {
      await download(videoUrl, videoPath);
    } catch (e) {
      console.warn(`  skip download: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    mux(videoPath, musicPath, outPath);

    const body = readFileSync(outPath);
    const { error } = await admin.storage.from("media").upload(objectPath, body, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (error) throw new Error(`upload ${objectPath}: ${error.message}`);

    const { data } = admin.storage.from("media").getPublicUrl(objectPath);
    clips.push({ theme: src.theme, url: data.publicUrl, hasAudio: true });
    console.log(`  ok ${data.publicUrl}`);
  }

  if (clips.length < 12) {
    throw new Error(`too few clips prepared: ${clips.length}`);
  }

  const file = `/** Auto-generated by scripts/prepare-jp-videos.ts — do not edit by hand. */
export type JpDemoVideoTheme =
  | "コーデ紹介"
  | "今日の服"
  | "ルックブック"
  | "GRWM"
  | "メイク"
  | "コスメ購入品"
  | "ネイル"
  | "バッグの中身"
  | "カフェ"
  | "スイーツ"
  | "旅行"
  | "推し活";

export type JpDemoVideoClip = {
  theme: JpDemoVideoTheme;
  url: string;
  hasAudio: true;
};

export const JP_DEMO_VIDEO_CLIPS: JpDemoVideoClip[] = ${JSON.stringify(clips, null, 2)};
`;
  writeFileSync(GENERATED, file);
  console.log(`\nwrote ${GENERATED} clips=${clips.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
