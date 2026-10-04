import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { verifyAppIconSet } from "./verify-ios-icons.mjs";

// Renders every NEWFIND app icon from one master SVG.
// iOS rejects app icons with an alpha channel (ITMS-90717), so every PNG is
// flattened onto the icon background and written as opaque 8-bit RGB.
//
//   node scripts/generate-ios-icons.mjs          # write icons, then verify
//   node scripts/generate-ios-icons.mjs --check  # fail if committed icons are stale

const root = process.cwd();
const masterPath = path.join(root, "public/brand/app-icon.svg");
const iconSet = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const BACKGROUND = "#0B0C09";

const WEB_ICONS = [
  { file: "public/brand/icon-1024.png", pixels: 1024 },
  { file: "public/brand/apple-touch-icon.png", pixels: 180 },
  { file: "public/brand/icon-32.png", pixels: 32 },
  { file: "app/apple-icon.png", pixels: 180 },
  { file: "app/icon.png", pixels: 32 },
];

const checkOnly = process.argv.includes("--check");
const master = await fs.readFile(masterPath);
const manifest = JSON.parse(await fs.readFile(path.join(iconSet, "Contents.json"), "utf8"));

async function render(pixels) {
  return sharp(master)
    .resize(pixels, pixels, { fit: "cover" })
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
}

async function rawPixels(buffer) {
  return sharp(buffer).removeAlpha().raw().toBuffer();
}

const targets = [];
for (const image of manifest.images ?? []) {
  if (!image.filename) continue;
  const filename = path.basename(image.filename);
  if (filename !== image.filename) {
    throw new Error(`Unsafe app icon filename: ${image.filename}`);
  }
  const [points] = String(image.size).split("x").map(Number);
  const scale = Number.parseFloat(String(image.scale ?? "1x"));
  const pixels = Math.round(points * scale);
  if (!Number.isFinite(pixels) || pixels < 1 || pixels > 1024) {
    throw new Error(`Invalid app icon dimensions for ${filename}`);
  }
  targets.push({ file: path.join(iconSet, filename), pixels });
}
for (const icon of WEB_ICONS) {
  targets.push({ file: path.join(root, icon.file), pixels: icon.pixels });
}

// The same file can be listed more than once (iPhone and iPad share sizes).
const unique = new Map();
for (const target of targets) {
  const previous = unique.get(target.file);
  if (previous && previous.pixels !== target.pixels) {
    throw new Error(`Conflicting sizes for ${path.relative(root, target.file)}`);
  }
  unique.set(target.file, target);
}

const stale = [];
for (const { file, pixels } of unique.values()) {
  const rendered = await render(pixels);
  if (checkOnly) {
    let current = null;
    try {
      current = await fs.readFile(file);
    } catch {
      stale.push(`${path.relative(root, file)} (missing)`);
      continue;
    }
    const meta = await sharp(current).metadata();
    const same =
      meta.width === pixels &&
      meta.height === pixels &&
      (await rawPixels(current)).equals(await rawPixels(rendered));
    if (!same) stale.push(path.relative(root, file));
  } else {
    await fs.writeFile(file, rendered);
  }
}

if (stale.length > 0) {
  throw new Error(
    `App icons are out of date with public/brand/app-icon.svg:\n  ${stale.join("\n  ")}\n` +
      "Run `node scripts/generate-ios-icons.mjs` and commit the result.",
  );
}

const report = await verifyAppIconSet(iconSet);
console.log(
  `${checkOnly ? "Checked" : "Generated"} ${unique.size} NEWFIND icon files; ` +
    `verified ${report.verified} AppIcon entries (opaque RGB, exact sizes).`,
);
