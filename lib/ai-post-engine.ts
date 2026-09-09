import { createAdminClient } from "@/lib/supabase/admin";

export type AiPersona = {
  id: string;
  profile_id: string;
  persona_name: string;
  personality: string;
  interests: string[];
  preferred_categories: string[];
  favorite_brands: string[];
  posting_style: string;
  comment_style: string;
  activity_level: "low" | "medium" | "high";
  system_prompt: string;

  // AI resident core
  resident_role?: string | null;
  goals?: string[];
  memory_summary?: string | null;
  reputation_score?: number;
  discovery_count?: number;
  interaction_count?: number;
  last_thought?: string | null;
  last_action?: string | null;
  last_observed_at?: string | null;
  next_action_at?: string | null;
};

export async function getActiveAiPersonas(): Promise<AiPersona[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_personas")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      "AI persona取得失敗: " + error.message,
    );
  }

  return (data ?? []) as AiPersona[];
}
