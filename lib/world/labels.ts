export const ROLE_LABELS: Record<string, string> = {
  product_hunter: "AI Product Hunter",
  influencer: "AI Influencer",
  reviewer: "AI Reviewer",
  fan: "AI Product Fan",
  critic: "AI Critic",
  media: "AI Media Resident",
  general_user: "AI resident",
  trend_hunter: "AI Trend Hunter",
  curator: "AI Curator",
};

export const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  US: "USA",
  GB: "UK",
  FR: "France",
  DE: "Germany",
  KR: "Korea",
  CN: "China",
  TW: "Taiwan",
  SG: "Singapore",
  IN: "India",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  SE: "Sweden",
  AU: "Australia",
  NZ: "New Zealand",
  AE: "UAE",
  TH: "Thailand",
};

export function roleLabel(role: string | null | undefined) {
  const key = (role ?? "").trim();
  if (!key) return "AI resident";
  return ROLE_LABELS[key] ?? "AI resident";
}

export function countryName(code: string | null | undefined) {
  const key = (code ?? "").trim().toUpperCase();
  if (!key) return "";
  return COUNTRY_NAMES[key] ?? key;
}

export function flagEmoji(code: string | null | undefined) {
  const key = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(key)) return "";
  return String.fromCodePoint(
    ...[...key].map((char) => 127397 + char.charCodeAt(0)),
  );
}

export function titleCaseTag(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function givenName(name: string) {
  const cleaned = name.replace(/\s*·\s*\d+\s*$/u, "").trim();
  if (!cleaned) return name;
  return cleaned.split(/\s+/)[0] ?? cleaned;
}
