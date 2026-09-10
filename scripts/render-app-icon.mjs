import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const LIME = "#C8FF00";
const BLACK = "#111111";

const MASTER = 1024;
const CX = 512;
const CY = 512;
const RADIUS = 190;
const DISTANCE = 230;
const ANGLE = (30 * Math.PI) / 180;
const STROKE = 52;
function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const DX = Math.cos(ANGLE) * (DISTANCE / 2);
const DY = Math.sin(ANGLE) * (DISTANCE / 2);
const C1 = { x: round(CX - DX), y: round(CY - DY) };
const C2 = { x: round(CX + DX), y: round(CY + DY) };

function circlePath(c, r) {
  const radius = round(r);
  return `M ${round(c.x - r)} ${round(c.y)} a ${radius} ${radius} 0 1 1 ${round(r * 2)} 0 a ${radius} ${radius} 0 1 1 ${round(-r * 2)} 0`;
}

function masterSvg({ background, padding = 0, size = MASTER }) {
  const scale = size / MASTER;
  const inset = padding;
  const view = size + inset * 2;
  const tx = inset;
  const ty = inset;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" width="${view}" height="${view}" role="img" aria-label="NEWFIND">
  ${background ? `<rect width="${view}" height="${view}" fill="${BLACK}"/>` : ""}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <defs>
      <clipPath id="world-a">
        <circle cx="${C1.x}" cy="${C1.y}" r="${RADIUS}"/>
      </clipPath>
    </defs>
    <circle cx="${C2.x}" cy="${C2.y}" r="${RADIUS}" fill="${LIME}" clip-path="url(#world-a)"/>
    <circle cx="${C1.x}" cy="${C1.y}" r="${RADIUS}" fill="none" stroke="${LIME}" stroke-width="${STROKE}"/>
    <circle cx="${C2.x}" cy="${C2.y}" r="${RADIUS}" fill="none" stroke="${LIME}" stroke-width="${STROKE}"/>
  </g>
</svg>
`;
}

function compactCenters() {
  const d = 9.7;
  const angle = (30 * Math.PI) / 180;
  const dx = Math.cos(angle) * (d / 2);
  const dy = Math.sin(angle) * (d / 2);
  return {
    r: 8.15,
    stroke: 2.4,
    a: { x: round(16 - dx), y: round(16 - dy) },
    b: { x: round(16 + dx), y: round(16 + dy) },
  };
}

function compactSvg() {
  const { r, stroke, a, b } = compactCenters();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="NEWFIND">
  <rect width="32" height="32" fill="${BLACK}"/>
  <defs>
    <clipPath id="world-a">
      <circle cx="${a.x}" cy="${a.y}" r="${r}"/>
    </clipPath>
  </defs>
  <circle cx="${b.x}" cy="${b.y}" r="${r}" fill="${LIME}" clip-path="url(#world-a)"/>
  <circle cx="${a.x}" cy="${a.y}" r="${r}" fill="none" stroke="${LIME}" stroke-width="${stroke}"/>
  <circle cx="${b.x}" cy="${b.y}" r="${r}" fill="none" stroke="${LIME}" stroke-width="${stroke}"/>
</svg>
`;
}

function compactFgSvg() {
  const { r, stroke, a, b } = compactCenters();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <clipPath id="world-a">
      <circle cx="${a.x}" cy="${a.y}" r="${r}"/>
    </clipPath>
  </defs>
  <circle cx="${b.x}" cy="${b.y}" r="${r}" fill="${LIME}" clip-path="url(#world-a)"/>
  <circle cx="${a.x}" cy="${a.y}" r="${r}" fill="none" stroke="${LIME}" stroke-width="${stroke}"/>
  <circle cx="${b.x}" cy="${b.y}" r="${r}" fill="none" stroke="${LIME}" stroke-width="${stroke}"/>
</svg>
`;
}

function androidVector() {
  const scale = 108 / MASTER;
  const a = { x: C1.x * scale, y: C1.y * scale };
  const b = { x: C2.x * scale, y: C2.y * scale };
  const r = RADIUS * scale;
  const stroke = STROKE * scale;

  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group>
        <clip-path android:pathData="${circlePath(a, r)}"/>
        <path
            android:fillColor="${LIME}"
            android:pathData="${circlePath(b, r)}"/>
    </group>
    <path
        android:fillColor="#00000000"
        android:strokeColor="${LIME}"
        android:strokeWidth="${round(stroke)}"
        android:pathData="${circlePath(a, r)}"/>
    <path
        android:fillColor="#00000000"
        android:strokeColor="${LIME}"
        android:strokeWidth="${round(stroke)}"
        android:pathData="${circlePath(b, r)}"/>
</vector>
`;
}

async function pngFromSvg(svg, size, { flatten = true, transparent = false } = {}) {
  let image = sharp(Buffer.from(svg)).resize(size, size, {
    fit: "fill",
    kernel: "lanczos3",
  });

  if (transparent) {
    image = image.ensureAlpha().png();
  } else if (flatten) {
    image = image.flatten({ background: BLACK }).ensureAlpha().png();
  } else {
    image = image.ensureAlpha().png();
  }

  return image.toBuffer();
}

async function writeFile(rel, contents) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  console.log("wrote", rel);
}

function icoFromPngs(entries) {
  const count = entries.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const bodies = [];

  entries.forEach((entry, index) => {
    const start = 6 + 16 * index;
    header.writeUInt8(entry.width >= 256 ? 0 : entry.width, start);
    header.writeUInt8(entry.height >= 256 ? 0 : entry.height, start + 1);
    header.writeUInt8(0, start + 2);
    header.writeUInt8(0, start + 3);
    header.writeUInt16LE(1, start + 4);
    header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(entry.png.length, start + 8);
    header.writeUInt32LE(offset, start + 12);
    offset += entry.png.length;
    bodies.push(entry.png);
  });

  return Buffer.concat([header, ...bodies]);
}

async function splashPng(width, height, logo) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BLACK,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function main() {
  const withBg = masterSvg({ background: true });
  const foreground = masterSvg({ background: false });
  const compact = compactSvg();
  const compactFg = compactFgSvg();

  await writeFile("public/brand/app-icon.svg", withBg);
  await writeFile("public/brand/n-mark.svg", compact);
  await writeFile("public/brand/n-mark-fg.svg", compactFg);
  await writeFile("app/icon.svg", compact);
  await writeFile(
    "android/app/src/main/res/drawable/ic_launcher_foreground.xml",
    androidVector(),
  );
  await writeFile(
    "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml",
    androidVector(),
  );

  const master1024 = await pngFromSvg(withBg, 1024);
  const apple180 = await pngFromSvg(withBg, 180);
  const icon32 = await pngFromSvg(compact, 32);
  const icon256 = await pngFromSvg(withBg, 256);
  const fg432 = await pngFromSvg(foreground, 432, { transparent: true });
  const favicon = icoFromPngs([
    { width: 32, height: 32, png: icon32 },
    { width: 256, height: 256, png: icon256 },
  ]);

  await writeFile("public/brand/icon-1024.png", master1024);
  await writeFile("public/brand/icon-32.png", icon32);
  await writeFile("public/brand/apple-touch-icon.png", apple180);
  await writeFile("app/apple-icon.png", apple180);
  await writeFile("app/icon.png", icon32);
  await writeFile("app/favicon.ico", favicon);
  await writeFile(
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    master1024,
  );

  const mipmap = [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ];

  for (const [density, launcher, foregroundSize] of mipmap) {
    const base = `android/app/src/main/res/mipmap-${density}`;
    const full = await pngFromSvg(withBg, launcher);
    const round = await pngFromSvg(withBg, launcher);
    const fg = await pngFromSvg(foreground, foregroundSize, { transparent: true });
    await writeFile(`${base}/ic_launcher.png`, full);
    await writeFile(`${base}/ic_launcher_round.png`, round);
    await writeFile(`${base}/ic_launcher_foreground.png`, fg);
  }

  await writeFile(
    "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
    fg432,
  );

  const androidSplashes = [
    ["drawable/splash.png", 480, 320],
    ["drawable-port-mdpi/splash.png", 320, 480],
    ["drawable-port-hdpi/splash.png", 480, 800],
    ["drawable-port-xhdpi/splash.png", 720, 1280],
    ["drawable-port-xxhdpi/splash.png", 960, 1600],
    ["drawable-port-xxxhdpi/splash.png", 1280, 1920],
    ["drawable-land-mdpi/splash.png", 480, 320],
    ["drawable-land-hdpi/splash.png", 800, 480],
    ["drawable-land-xhdpi/splash.png", 1280, 720],
    ["drawable-land-xxhdpi/splash.png", 1600, 960],
    ["drawable-land-xxxhdpi/splash.png", 1920, 1280],
  ];

  for (const [rel, width, height] of androidSplashes) {
    const logoSize = Math.round(Math.min(width, height) * 0.22);
    const logo = await pngFromSvg(withBg, logoSize);
    await writeFile(
      `android/app/src/main/res/${rel}`,
      await splashPng(width, height, logo),
    );
  }

  const iosLogo = await pngFromSvg(withBg, 600);
  const iosSplash = await splashPng(2732, 2732, iosLogo);
  for (const name of [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
  ]) {
    await writeFile(
      `ios/App/App/Assets.xcassets/Splash.imageset/${name}`,
      iosSplash,
    );
  }

  console.log("icon render complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
