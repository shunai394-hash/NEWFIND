import { createAdminClient } from "@/lib/supabase/admin";
import { createAiPersona } from "@/lib/ai-personas";
import {
  FEATURED_INFLUENCER,
  FEATURED_LIVING_RESIDENTS,
  type FeaturedLivingResident,
} from "@/lib/ai/featured-living-residents";
import { SPECIALIST_PRODUCT_HUNTERS } from "@/lib/ai/specialist-product-hunters";
import { WORLD_SCOUTS } from "@/lib/ai/world-scouts";

const NAMED_RESIDENTS: FeaturedLivingResident[] = [
  ...FEATURED_LIVING_RESIDENTS,
  ...SPECIALIST_PRODUCT_HUNTERS,
  ...WORLD_SCOUTS,
];
// FEATURED_INFLUENCER is not auto-created here. Use scripts/seed-named-influencer.ts.

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
  const profilePatch: {
    display_name: string;
    bio: string;
    avatar_url?: string;
  } = {
    display_name: spec.displayName,
    bio: spec.bio ?? spec.personality,
  };

  if (spec.avatarUrl) {
    profilePatch.avatar_url = spec.avatarUrl;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
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
      favorite_brands: spec.favoriteBrands ?? [],
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

async function ensureOne(
  spec: FeaturedLivingResident,
): Promise<FeaturedResidentEnsureResult> {
  if (!spec.avatarUrl) {
    return {
      username: spec.username,
      personaName: spec.personaName,
      profileId: null,
      status: "failed",
      detail: "avatar_url is required for named AI residents",
    };
  }

  const admin = createAdminClient();
  const existing = await findPersona(admin, spec);

  if (existing?.profile_id) {
    await syncExisting(admin, spec, {
      id: existing.id,
      profile_id: existing.profile_id,
    });
    return {
      username: spec.username,
      personaName: spec.personaName,
      profileId: existing.profile_id,
      status: "updated",
    };
  }

  const created = await createAiPersona(spec);
  return {
    username: spec.username,
    personaName: spec.personaName,
    profileId: created.profileId,
    status: "created",
  };
}

export async function ensureFeaturedLivingResidents(): Promise<
  FeaturedResidentEnsureResult[]
> {
  const results: FeaturedResidentEnsureResult[] = [];

  for (const spec of NAMED_RESIDENTS) {
    try {
      results.push(await ensureOne(spec));
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

export async function ensureNamedInfluencer(): Promise<FeaturedResidentEnsureResult> {
  return ensureOne(FEATURED_INFLUENCER);
}
