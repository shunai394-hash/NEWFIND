import { isDiscoveryAdmin } from "@/lib/discovery/admin";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function getDiscoveryAdminState() {
  if (!isSupabaseConfigured()) {
    return { admin: true, email: null as string | null };
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? null;
    let flag = false;
    if (data.user?.id) {
      const profile = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle();
      flag = Boolean((profile.data as { is_admin?: boolean } | null)?.is_admin);
    }
    return { admin: isDiscoveryAdmin(email, flag), email };
  } catch {
    return { admin: false, email: null as string | null };
  }
}
