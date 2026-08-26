export function normalizeBrand(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, "")
    .trim();
}

export function normalizeProductName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
