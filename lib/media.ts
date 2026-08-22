import type { MediaType } from "@/lib/types";

export function mediaTypeFromFile(file: File): MediaType {
  return file.type.startsWith("video/") ? "video" : "photo";
}

export async function fileToStoredUrl(file: File): Promise<{
  url: string;
  type: MediaType;
}> {
  const type = mediaTypeFromFile(file);

  if (type === "photo") {
    return { url: await resizeImage(file), type };
  }

  if (file.size <= 1_800_000) {
    return { url: await readAsDataUrl(file), type };
  }

  return { url: URL.createObjectURL(file), type };
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const max = 1080;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = src;
  });
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
