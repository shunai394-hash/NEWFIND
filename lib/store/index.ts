import { isSupabaseConfigured } from "@/lib/config";
import { localStore } from "@/lib/store/local";
import { supabaseStore } from "@/lib/store/supabase";
import type { Store } from "@/lib/store/types";

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore : localStore;
}

export function storeMode(): "local" | "supabase" {
  return isSupabaseConfigured() ? "supabase" : "local";
}
