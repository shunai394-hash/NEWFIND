export type WorldResidentAvatarInput = {
  username: string;
  displayName: string;
  residentRole?: string;
  countryCode?: string;
  region?: string;
};

function encodeSeed(value: string) {
  return encodeURIComponent(value.trim() || "newfind-resident");
}

export function buildWorldResidentAvatarUrl(
  input: WorldResidentAvatarInput,
) {
  const seed = [
    input.username,
    input.displayName,
    input.residentRole ?? "general_user",
    input.countryCode ?? "",
    input.region ?? "",
  ]
    .filter(Boolean)
    .join("-");

  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeSeed(seed)}`;
}
