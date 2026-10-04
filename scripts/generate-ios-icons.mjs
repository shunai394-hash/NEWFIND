import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const iconSet = path.join(
  root,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset",
);
const manifestPath = path.join(iconSet, "Contents.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#C6FF00"/>
  <g fill="none" stroke="#10110D" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="432" cy="425" r="246" stroke-width="58"/>
    <path d="M612 606 808 802" stroke-width="78"/>
  </g>
  <path d="M432 282 466 385 569 419 466 453 432 556 398 453 295 419 398 385Z" fill="#10110D"/>
  <circle cx="682" cy="250" r="27" fill="#10110D"/>
</svg>`;

let generated = 0;
for (const image of manifest.images ?? []) {
  if (!image.filename) continue;
  const filename = path.basename(image.filename);
  if (filename !== image.filename) {
    throw new Error(`Unsafe app icon filename: ${image.filename}`);
  }

  const [points] = String(image.size).split("x").map(Number);
  const scale = Number.parseInt(String(image.scale ?? "1x"), 10);
  const pixels = Math.round(points * scale);
  if (!Number.isFinite(pixels) || pixels < 1 || pixels > 1024) {
    throw new Error(`Invalid app icon dimensions for ${filename}`);
  }

  const outputPath = path.join(iconSet, filename);
  await sharp(Buffer.from(svg))
    .resize(pixels, pixels, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== pixels || metadata.height !== pixels || metadata.format !== "png") {
    throw new Error(`App icon verification failed: ${filename}`);
  }
  generated += 1;
}

if (generated < 1) throw new Error("No app icons were generated.");
console.log(`Generated and verified ${generated} final NEWFIND app icon assets.`);
