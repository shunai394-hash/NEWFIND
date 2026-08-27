import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";

export async function authHeaders(): Promise<HeadersInit> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}
