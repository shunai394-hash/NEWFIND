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

/**
 * Geometric 5x7 bitmap for NEWFIND. Drawn as SVG rects so the App Store
 * 1024 icon stays recognizable without depending on system fonts.
 */
const WORDMARK = {
  N: ["10001", "11001", "10101", "10011", "10001"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  W: ["10001", "10001", "10101", "10101", "01110"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "11111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
};

function wordmarkSvg(cx, cy, cell = 14, gap = 18) {
  const letters = "NEWFIND".split("");
  const letterWidth = 5 * cell;
  const letterHeight = 5 * cell;
  const total =
    letters.length * letterWidth + (letters.length - 1) * gap;
  let x = cx - total / 2;
  const y = cy - letterHeight / 2;
  const rects = [];

  for (const letter of letters) {
    const grid = WORDMARK[letter];
    grid.forEach((row, rowIndex) => {
      [...row].forEach((bit, colIndex) => {
        if (bit !== "1") return;
        rects.push(
          `<rect x="${round(x + colIndex * cell)}" y="${round(y + rowIndex * cell)}" width="${cell}" height="${cell}" fill="${LIME}"/>`,
        );
      });
    });
    x += letterWidth + gap;
  }

  return rects.join("");
}

function masterSvg({
  background,
  padding = 0,
  size = MASTER,
  wordmark = false,
  markScale = 1,
  markY = 0,
} = {}) {
  const scale = (size / MASTER) * markScale;
  const inset = padding;
  const view = size + inset * 2;
  const tx = inset + (size - size * markScale) / 2;
  const ty = inset + (size - size * markScale) / 2 + markY;

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
  ${wordmark ? wordmarkSvg(view / 2, view * 0.86, 13, 16) : ""}
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

async function pngFromSvg(
  svg,
  size,
  { flatten = true, transparent = false, opaque = false } = {},
) {
  let image = sharp(Buffer.from(svg)).resize(size, size, {
    fit: "fill",
    kernel: "lanczos3",
  });

  if (transparent) {
    image = image.ensureAlpha().png();
  } else if (opaque) {
    image = image
      .flatten({ background: BLACK })
      .removeAlpha()
      .png({ compressionLevel: 9, force: true });
  } else if (flatten) {
    image = image.flatten({ background: BLACK }).png();
  } else {
    image = image.png();
  }

  return image.toBuffer();
}

async function writeFile(rel, contents) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  console.log("wrote", rel);
}

function iosContentsJson() {
  return `${JSON.stringify(
    {
      images: [
        {
          filename: "icon-20@2x.png",
          idiom: "iphone",
          scale: "2x",
          size: "20x20",
        },
        {
          filename: "icon-20@3x.png",
          idiom: "iphone",
          scale: "3x",
          size: "20x20",
        },
        {
          filename: "icon-29@2x.png",
          idiom: "iphone",
          scale: "2x",
          size: "29x29",
        },
        {
          filename: "icon-29@3x.png",
          idiom: "iphone",
          scale: "3x",
          size: "29x29",
        },
        {
          filename: "icon-40@2x.png",
          idiom: "iphone",
          scale: "2x",
          size: "40x40",
        },
        {
          filename: "icon-40@3x.png",
          idiom: "iphone",
          scale: "3x",
          size: "40x40",
        },
        {
          filename: "icon-60@2x.png",
          idiom: "iphone",
          scale: "2x",
          size: "60x60",
        },
        {
          filename: "icon-60@3x.png",
          idiom: "iphone",
          scale: "3x",
          size: "60x60",
        },
        {
          filename: "icon-20.png",
          idiom: "ipad",
          scale: "1x",
          size: "20x20",
        },
        {
          filename: "icon-20@2x.png",
          idiom: "ipad",
          scale: "2x",
          size: "20x20",
        },
        {
          filename: "icon-29.png",
          idiom: "ipad",
          scale: "1x",
          size: "29x29",
        },
        {
          filename: "icon-29@2x.png",
          idiom: "ipad",
          scale: "2x",
          size: "29x29",
        },
        {
          filename: "icon-40.png",
          idiom: "ipad",
          scale: "1x",
          size: "40x40",
        },
        {
          filename: "icon-40@2x.png",
          idiom: "ipad",
          scale: "2x",
          size: "40x40",
        },
        {
          filename: "icon-76.png",
          idiom: "ipad",
          scale: "1x",
          size: "76x76",
        },
        {
          filename: "icon-76@2x.png",
          idiom: "ipad",
          scale: "2x",
          size: "76x76",
        },
        {
          filename: "icon-83.5@2x.png",
          idiom: "ipad",
          scale: "2x",
          size: "83.5x83.5",
        },
        {
          filename: "AppIcon.png",
          idiom: "ios-marketing",
          scale: "1x",
          size: "1024x1024",
        },
      ],
      info: {
        author: "xcode",
        version: 1,
      },
    },
    null,
    2,
  )}\n`;
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
  const withBg = masterSvg({ background: true, markScale: 1.08 });
  const marketing = masterSvg({
    background: true,
    markScale: 0.82,
    markY: -70,
    wordmark: true,
  });
  const foreground = masterSvg({ background: false, markScale: 1.08 });
  const compact = compactSvg();
  const compactFg = compactFgSvg();

  await writeFile("public/brand/app-icon.svg", marketing);
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

  const master1024 = await pngFromSvg(withBg, 1024, { opaque: true });
  const marketing1024 = await pngFromSvg(marketing, 1024, { opaque: true });
  const apple180 = await pngFromSvg(withBg, 180, { opaque: true });
  const icon32 = await pngFromSvg(compact, 32, { opaque: true });
  const icon256 = await pngFromSvg(withBg, 256, { opaque: true });
  const fg432 = await pngFromSvg(foreground, 432, { transparent: true });
  const favicon = icoFromPngs([
    { width: 32, height: 32, png: icon32 },
    { width: 256, height: 256, png: icon256 },
  ]);

  await writeFile("public/brand/icon-1024.png", marketing1024);
  await writeFile("public/brand/icon-32.png", icon32);
  await writeFile("public/brand/apple-touch-icon.png", apple180);
  await writeFile("app/apple-icon.png", apple180);
  await writeFile("app/icon.png", icon32);
  await writeFile("app/favicon.ico", favicon);

  const iosDir = "ios/App/App/Assets.xcassets/AppIcon.appiconset";
  const iosIcons = [
    ["icon-20.png", 20],
    ["icon-20@2x.png", 40],
    ["icon-20@3x.png", 60],
    ["icon-29.png", 29],
    ["icon-29@2x.png", 58],
    ["icon-29@3x.png", 87],
    ["icon-40.png", 40],
    ["icon-40@2x.png", 80],
    ["icon-40@3x.png", 120],
    ["icon-60@2x.png", 120],
    ["icon-60@3x.png", 180],
    ["icon-76.png", 76],
    ["icon-76@2x.png", 152],
    ["icon-83.5@2x.png", 167],
  ];

  for (const [name, size] of iosIcons) {
    await writeFile(
      `${iosDir}/${name}`,
      await pngFromSvg(withBg, size, { opaque: true }),
    );
  }
  await writeFile(`${iosDir}/AppIcon.png`, marketing1024);
  await writeFile(`${iosDir}/Contents.json`, iosContentsJson());

  const leftover = path.join(ROOT, `${iosDir}/AppIcon-512@2x.png`);
  if (fs.existsSync(leftover)) {
    fs.unlinkSync(leftover);
    console.log("removed", "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
  }

  const mipmap = [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ];

  for (const [density, launcher, foregroundSize] of mipmap) {
    const base = `android/app/src/main/res/mipmap-${density}`;
    const full = await pngFromSvg(withBg, launcher, { opaque: true });
    const round = await pngFromSvg(withBg, launcher, { opaque: true });
    const fg = await pngFromSvg(foreground, foregroundSize, {
      transparent: true,
    });
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
    const logo = await pngFromSvg(withBg, logoSize, { opaque: true });
    await writeFile(
      `android/app/src/main/res/${rel}`,
      await splashPng(width, height, logo),
    );
  }

  const iosLogo = await pngFromSvg(withBg, 600, { opaque: true });
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

  // Keep a copy of the home-screen mark for web/docs.
  await writeFile("public/brand/icon-home-1024.png", master1024);

  console.log("icon render complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
