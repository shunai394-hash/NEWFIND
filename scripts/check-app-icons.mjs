import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const IOS_DIR = path.join(
  ROOT,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const contents = JSON.parse(
    fs.readFileSync(path.join(IOS_DIR, "Contents.json"), "utf8"),
  );
  const filenames = contents.images.map((item) => item.filename);
  assert(!filenames.includes("AppIcon-512@2x.png"), "Capacitor placeholder filename still present");
  assert(filenames.includes("AppIcon.png"), "App Store 1024 AppIcon.png missing");

  for (const image of contents.images) {
    const file = path.join(IOS_DIR, image.filename);
    assert(fs.existsSync(file), `missing ${image.filename}`);
    const meta = await sharp(file).metadata();
    assert(meta.format === "png", `${image.filename} is not png`);
    assert(!meta.hasAlpha, `${image.filename} still has alpha`);
    const [w, h] = image.size.split("x").map(Number);
    const scale = Number(image.scale.replace("x", ""));
    const expected = Math.round(w * scale);
    const expectedH = Math.round(h * scale);
    assert(
      meta.width === expected && meta.height === expectedH,
      `${image.filename} is ${meta.width}x${meta.height}, expected ${expected}x${expectedH}`,
    );
  }

  const iosMarketing = path.join(IOS_DIR, "AppIcon.png");
  const iosHome = path.join(ROOT, "public/brand/icon-home-1024.png");
  assert(
    crypto.createHash("sha256").update(fs.readFileSync(iosMarketing)).digest("hex") ===
      crypto.createHash("sha256").update(fs.readFileSync(iosHome)).digest("hex"),
    "iOS App Store icon must match the finalized home-screen icon artwork",
  );

  const android = path.join(
    ROOT,
    "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  );
  const androidMeta = await sharp(android).metadata();
  assert(androidMeta.width === 192, "android xxxhdpi launcher size");

  const leftover = path.join(IOS_DIR, "AppIcon-512@2x.png");
  assert(!fs.existsSync(leftover), "old AppIcon-512@2x.png leftover");

  console.log("ICON CHECK PASSED");
  console.log(`iOS AppIcon files: ${new Set(filenames).size}`);
  console.table(
    contents.images.map((item) => ({
      idiom: item.idiom,
      size: item.size,
      scale: item.scale,
      filename: item.filename,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
