import { isSupabaseConfigured } from "@/lib/config";

export function discoveryAdminEmails() {
  return (process.env.DISCOVERY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isDiscoveryAdmin(email: string | null | undefined, isAdminFlag = false) {
  if (isAdminFlag) return true;
  const value = email?.trim().toLowerCase() ?? "";
  const emails = discoveryAdminEmails();
  if (emails.length > 0) return Boolean(value && emails.includes(value));
  if (!isSupabaseConfigured()) return true;
  return false;
}
