import { createAdminClient } from "@/lib/supabase/admin";
import { createAiPersona } from "@/lib/ai-personas";
import {
  FEATURED_LIVING_RESIDENTS,
  type FeaturedLivingResident,
} from "@/lib/ai/featured-living-residents";

export type FeaturedResidentEnsureResult = {
  username: string;
  personaName: string;
  profileId: string | null;
  status: "created" | "updated" | "skipped" | "failed";
  detail?: string;
};

async function findPersona(
  admin: ReturnType<typeof createAdminClient>,
  spec: FeaturedLivingResident,
) {
  const byName = await admin
    .from("ai_personas")
    .select("id, profile_id, persona_name")
    .eq("persona_name", spec.personaName)
    .maybeSingle();

  if (byName.data?.profile_id) {
    return byName.data;
  }

  const byUsername = await admin
    .from("profiles")
    .select("id, username")
    .eq("username", spec.username)
    .maybeSingle();

  if (!byUsername.data?.id) return null;

  const persona = await admin
    .from("ai_personas")
    .select("id, profile_id, persona_name")
    .eq("profile_id", byUsername.data.id)
    .maybeSingle();

  return persona.data ?? null;
}

async function syncExisting(
  admin: ReturnType<typeof createAdminClient>,
  spec: FeaturedLivingResident,
  persona: { id: string; profile_id: string },
) {
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      display_name: spec.displayName,
      bio: spec.personality,
      avatar_url: spec.avatarUrl ?? null,
    })
    .eq("id", persona.profile_id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const usernameCheck = await admin
    .from("profiles")
    .select("username")
    .eq("id", persona.profile_id)
    .maybeSingle();

  if (!usernameCheck.data?.username) {
    const { error: usernameError } = await admin
      .from("profiles")
      .update({ username: spec.username })
      .eq("id", persona.profile_id);

    if (usernameError) {
      console.warn(
        "Featured resident username update skipped:",
        spec.personaName,
        usernameError.message,
      );
    }
  }

  const { error: personaError } = await admin
    .from("ai_personas")
    .update({
      personality: spec.personality,
      interests: spec.interests ?? [],
      preferred_categories: spec.preferredCategories ?? [],
      posting_style: spec.postingStyle ?? "",
      comment_style: spec.commentStyle ?? "",
      activity_level: spec.activityLevel ?? "medium",
      system_prompt: spec.systemPrompt ?? "",
      resident_role: spec.residentRole ?? "general_user",
      goals: spec.goals ?? [],
      country_code: spec.countryCode ?? "",
      region: spec.region ?? "",
      languages: spec.languages ?? [],
      expertise: spec.expertise ?? [],
      values: spec.values ?? [],
      culture: spec.culture ?? "",
      is_active: true,
    })
    .eq("id", persona.id);

  if (personaError) {
    throw new Error(personaError.message);
  }
}

export async function ensureFeaturedLivingResidents(): Promise<
  FeaturedResidentEnsureResult[]
> {
  const admin = createAdminClient();
  const results: FeaturedResidentEnsureResult[] = [];

  for (const spec of FEATURED_LIVING_RESIDENTS) {
    try {
      const existing = await findPersona(admin, spec);

      if (existing?.profile_id) {
        await syncExisting(admin, spec, {
          id: existing.id,
          profile_id: existing.profile_id,
        });
        results.push({
          username: spec.username,
          personaName: spec.personaName,
          profileId: existing.profile_id,
          status: "updated",
        });
        continue;
      }

      const created = await createAiPersona(spec);
      results.push({
        username: spec.username,
        personaName: spec.personaName,
        profileId: created.profileId,
        status: "created",
      });
    } catch (error) {
      console.error(
        "Featured resident ensure failed:",
        spec.personaName,
        error,
      );
      results.push({
        username: spec.username,
        personaName: spec.personaName,
        profileId: null,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
