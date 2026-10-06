import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Validates ios/App/App/Assets.xcassets/AppIcon.appiconset against what
// App Store Connect and Xcode require for an iPhone + iPad app.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_TYPE_RGB = 2;

// idiom/size/scale entries an iPhone + iPad app must ship.
export const REQUIRED_ICON_SLOTS = [
  ["iphone", "20x20", "2x"],
  ["iphone", "20x20", "3x"],
  ["iphone", "29x29", "2x"],
  ["iphone", "29x29", "3x"],
  ["iphone", "40x40", "2x"],
  ["iphone", "40x40", "3x"],
  ["iphone", "60x60", "2x"],
  ["iphone", "60x60", "3x"],
  ["ipad", "20x20", "1x"],
  ["ipad", "20x20", "2x"],
  ["ipad", "29x29", "1x"],
  ["ipad", "29x29", "2x"],
  ["ipad", "40x40", "1x"],
  ["ipad", "40x40", "2x"],
  ["ipad", "76x76", "1x"],
  ["ipad", "76x76", "2x"],
  ["ipad", "83.5x83.5", "2x"],
  ["ios-marketing", "1024x1024", "1x"],
];

function readPngHeader(buffer, label) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${label}: not a PNG file`);
  }
  if (buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${label}: missing IHDR chunk`);
  }
  const chunks = new Set();
  for (let offset = 8; offset + 8 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    chunks.add(buffer.toString("ascii", offset + 4, offset + 8));
    offset += 12 + length;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    hasTransparencyChunk: chunks.has("tRNS"),
  };
}

export async function verifyAppIconSet(iconSet) {
  const manifest = JSON.parse(await fs.readFile(path.join(iconSet, "Contents.json"), "utf8"));
  const images = manifest.images ?? [];
  const problems = [];

  for (const [idiom, size, scale] of REQUIRED_ICON_SLOTS) {
    const entry = images.find(
      (image) => image.idiom === idiom && image.size === size && image.scale === scale,
    );
    if (!entry?.filename) problems.push(`missing ${idiom} ${size}@${scale}`);
  }

  const referenced = new Set();
  let verified = 0;
  for (const image of images) {
    if (!image.filename) continue;
    referenced.add(image.filename);
    const label = `${image.filename} (${image.idiom} ${image.size}@${image.scale})`;
    const [points] = String(image.size).split("x").map(Number);
    const expected = Math.round(points * Number.parseFloat(String(image.scale)));

    let buffer;
    try {
      buffer = await fs.readFile(path.join(iconSet, image.filename));
    } catch {
      problems.push(`${label}: file does not exist`);
      continue;
    }

    let header;
    try {
      header = readPngHeader(buffer, label);
    } catch (error) {
      problems.push(error.message);
      continue;
    }
    if (header.width !== expected || header.height !== expected) {
      problems.push(`${label}: ${header.width}x${header.height}, expected ${expected}x${expected}`);
    }
    if (header.bitDepth !== 8) problems.push(`${label}: bit depth ${header.bitDepth}, expected 8`);
    if (header.colorType !== COLOR_TYPE_RGB || header.hasTransparencyChunk) {
      problems.push(`${label}: has an alpha channel or transparency; App Store requires opaque icons`);
    }

    // A flat single-colour image is a placeholder, not an icon.
    const stats = await sharp(buffer).stats();
    const spread = Math.max(...stats.channels.map((channel) => channel.max - channel.min));
    if (spread < 64) problems.push(`${label}: image is nearly a flat colour (placeholder?)`);

    verified += 1;
  }

  const onDisk = (await fs.readdir(iconSet)).filter((name) => name.toLowerCase().endsWith(".png"));
  for (const name of onDisk) {
    if (!referenced.has(name)) problems.push(`${name}: not referenced by Contents.json (stale icon)`);
  }

  if (problems.length > 0) {
    throw new Error(`AppIcon.appiconset is not release-ready:\n  ${problems.join("\n  ")}`);
  }
  return { verified };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const iconSet = path.resolve(
    process.argv[2] ?? "ios/App/App/Assets.xcassets/AppIcon.appiconset",
  );
  const { verified } = await verifyAppIconSet(iconSet);
  console.log(`Verified ${verified} AppIcon entries in ${path.relative(process.cwd(), iconSet)}.`);
}
