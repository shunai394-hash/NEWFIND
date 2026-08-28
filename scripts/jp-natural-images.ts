/** JP demo images v2: stock photos (NOT gen_* AI). QA before apply. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CANDIDATE_DIR,
  FETCH_TARGETS,
  MANIFEST_PATH,
  PEXELS,
  REVIEW_HTML,
  UNSPLASH,
  type CandidateCat,
  type CandidateRow,
  type Manifest,
  pexelsUrl,
  safeFilename,
  themeFor,
  unsplashUrl,
} from "./jp-natural-images-shared";

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      version: 2,
      deprecatedGenPrefix: "gen:",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidates: [],
    };
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

function writeManifest(m: Manifest) {
  m.updatedAt = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), "utf8");
}

async function download(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "NEWFIND-jp-natural/2", Accept: "image/*" },
  });
  if (!res.ok) throw new Error(String(res.status));
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 8000) throw new Error("small");
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not image");
    return { buf, ext: "png" as const };
  }
  return { buf, ext: "jpg" as const };
}

function sources() {
  const out: Array<{ id: string; cat: CandidateCat; source: "pexels" | "unsplash"; url: string }> = [];
  const seen = new Set<string>();
  for (const cat of Object.keys(FETCH_TARGETS) as CandidateCat[]) {
    for (const pid of PEXELS[cat]) {
      const id = `p:${pid}`;
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, cat, source: "pexels", url: pexelsUrl(pid) });
      }
    }
    for (const uid of UNSPLASH[cat]) {
      const id = `u:${uid}`;
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, cat, source: "unsplash", url: unsplashUrl(uid) });
      }
    }
  }
  return out;
}

async function cmdFetch() {
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  const manifest = readManifest();
  const counts: Record<CandidateCat, number> = {
    fashion: 0,
    beauty: 0,
    food: 0,
    lifestyle: 0,
    home: 0,
  };
  let ok = 0;
  let fail = 0;
  for (const src of sources()) {
    if (counts[src.cat] >= FETCH_TARGETS[src.cat]) continue;
    const prev = manifest.candidates.find((c) => c.id === src.id);
    if (prev && existsSync(resolve(CANDIDATE_DIR, prev.localFile))) {
      counts[src.cat] += 1;
      continue;
    }
    try {
      const { buf, ext } = await download(src.url);
      const localFile = `${safeFilename(src.id)}.${ext}`;
      writeFileSync(resolve(CANDIDATE_DIR, localFile), buf);
      const meta = themeFor(src.cat, counts[src.cat]);
      const row: CandidateRow = {
        id: src.id,
        cat: src.cat,
        theme: meta.theme,
        note: meta.note,
        source: src.source,
        sourceUrl: src.url,
        localFile,
        status: "pending",
      };
      const i = manifest.candidates.findIndex((c) => c.id === src.id);
      if (i >= 0) manifest.candidates[i] = row;
      else manifest.candidates.push(row);
      counts[src.cat] += 1;
      ok += 1;
      await new Promise((r) => setTimeout(r, 120));
    } catch {
      fail += 1;
    }
  }
  writeManifest(manifest);
  cmdHtml();
  console.log(JSON.stringify({ ok, fail, counts, total: manifest.candidates.length }));
}

function cmdMark(action: "approve" | "reject", id: string, reason?: string) {
  const m = readManifest();
  const row = m.candidates.find((c) => c.id === id);
  if (!row) throw new Error(`unknown ${id}`);
  row.status = action === "approve" ? "approved" : "rejected";
  row.reviewedAt = new Date().toISOString();
  if (reason) row.rejectReason = reason;
  writeManifest(m);
}

function cmdStats() {
  const m = readManifest();
  const s = { pending: 0, approved: 0, rejected: 0 };
  const ac: Record<string, number> = {};
  for (const c of m.candidates) {
    s[c.status] += 1;
    if (c.status === "approved") ac[c.cat] = (ac[c.cat] ?? 0) + 1;
  }
  console.log(JSON.stringify({ total: m.candidates.length, s, ac }, null, 2));
}

function cmdHtml() {
  const m = readManifest();
  const body = m.candidates
    .map(
      (c) =>
        `<section style="width:360px;margin:8px;padding:8px;border:1px solid #ccc">` +
        `<img src="./${c.localFile}" width="340"/>` +
        `<p><b>${c.id}</b> ${c.status} ${c.cat}</p>` +
        `<p>${c.theme} / ${c.note}</p></section>`,
    )
    .join("");
  writeFileSync(
    REVIEW_HTML,
    `<!doctype html><meta charset=utf-8><title>JP v2 review</title>` +
      `<body><h1>Review (${m.candidates.length})</h1>` +
      `<div style="display:flex;flex-wrap:wrap">${body}</div></body>`,
    "utf8",
  );
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "fetch") cmdFetch().catch(console.error);
else if (cmd === "html") cmdHtml();
else if (cmd === "stats") cmdStats();
else if (cmd === "mark") cmdMark(args[0] as "approve" | "reject", args[1]!, args.slice(2).join(" "));
else
  console.log(
    "Usage: npx tsx scripts/jp-natural-images.ts fetch|html|stats|mark approve|reject <id> [reason]",
  );