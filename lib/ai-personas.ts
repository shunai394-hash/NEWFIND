import { createAdminClient } from "@/lib/supabase/admin";

export type CreateAiPersonaInput = {
  username: string;
  displayName: string;
  personaName: string;
  personality: string;
  avatarUrl?: string;
  interests?: string[];
  preferredCategories?: string[];
  favoriteBrands?: string[];
  postingStyle?: string;
  commentStyle?: string;
  activityLevel?: "low" | "medium" | "high";
  systemPrompt?: string;
  residentRole?: string;
  goals?: string[];
  countryCode?: string;
  region?: string;
  languages?: string[];
  expertise?: string[];
  values?: string[];
  culture?: string;
};

function createInternalEmail(username: string, userId: string) {
  const safeUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return "ai-" + safeUsername + "-" + userId.slice(0, 8) + "@example.com";
}

function createRandomPassword() {
  return "TestPassword-" + crypto.randomUUID();
}

export async function createAiPersona(input: CreateAiPersonaInput) {
  const admin = createAdminClient();

  const tempId = crypto.randomUUID();
  const email = createInternalEmail(input.username, tempId);
  const password = createRandomPassword();

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {},
    });

  if (authError || !authData.user) {
    console.error("Supabase Auth error:", authError);
    throw new Error("AI Auth user creation failed: " + JSON.stringify(authError));
  }

  const profileId = authData.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username: input.username,
      display_name: input.displayName,
      bio: input.personality,
      avatar_url: input.avatarUrl ?? null,
    })
    .eq("id", profileId);

  if (profileError) {
    await admin.auth.admin.deleteUser(profileId);
    throw new Error(
      "AI profile setup failed: " + profileError.message,
    );
  }

  const { data: persona, error: personaError } = await admin
    .from("ai_personas")
    .insert({
      profile_id: profileId,
      persona_name: input.personaName,
      personality: input.personality,
      interests: input.interests ?? [],
      preferred_categories: input.preferredCategories ?? [],
      favorite_brands: input.favoriteBrands ?? [],
      posting_style: input.postingStyle ?? "",
      comment_style: input.commentStyle ?? "",
      activity_level: input.activityLevel ?? "medium",
      system_prompt: input.systemPrompt ?? "",
      resident_role: input.residentRole ?? "general_user",
      goals: input.goals ?? [],
      country_code: input.countryCode ?? "",
      region: input.region ?? "",
      languages: input.languages ?? [],
      expertise: input.expertise ?? [],
      values: input.values ?? [],
      culture: input.culture ?? "",
      is_active: true,
    })
    .select("*")
    .single();

  if (personaError) {
    await admin.auth.admin.deleteUser(profileId);
    throw new Error(
      "AI persona creation failed: " + personaError.message,
    );
  }

  return {
    profileId,
    persona,
  };
}
