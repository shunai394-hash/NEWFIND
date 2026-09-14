import { createAdminClient } from "@/lib/supabase/admin";

export type AiPersona = {
  id: string;
  profile_id: string;
  persona_name: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
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

  // World resident attributes
  country_code?: string | null;
  region?: string | null;
  languages?: string[];
  expertise?: string[];
  values?: string[];
  culture?: string | null;
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

  const personas = (data ?? []) as AiPersona[];

  if (personas.length === 0) {
    return [];
  }

  const profileIds = [
    ...new Set(
      personas
        .map((persona) => persona.profile_id)
        .filter(Boolean),
    ),
  ];

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", profileIds);

  if (profileError) {
    throw new Error(
      "AI profile取得失敗: " + profileError.message,
    );
  }

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return personas.map((persona) => {
    const profile = profileMap.get(persona.profile_id);

    return {
      ...persona,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}
