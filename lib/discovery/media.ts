import { isDummyUrl } from "@/lib/products/discovery-filter";

const DUMMY_IMAGE_HINTS = [
  "placeholder",
  "placehold.co",
  "placekitten",
  "via.placeholder",
  "dummyimage",
  "picsum.photos",
];

export function isUsableProductImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  if (isDummyUrl(value)) return false;

  const lower = value.toLowerCase();
  if (DUMMY_IMAGE_HINTS.some((hint) => lower.includes(hint))) return false;
  if (lower.startsWith("data:")) return false;
  if (lower.includes("/products/") && lower.endsWith(".svg")) return false;
  if (lower.startsWith("/") && !lower.startsWith("//") && lower.endsWith(".svg")) {
    return false;
  }
  return true;
}
