import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createAdminClient } from "@/lib/supabase/admin";
import { buildWorldResidentAvatarUrl } from "@/lib/ai/world-resident-avatar";

async function main() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_personas")
    .select(`
      id,
      profile_id,
      persona_name,
      resident_role,
      country_code,
      region,
      profiles!inner (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  let updated = 0;

  for (const row of data ?? []) {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;

    if (profile?.avatar_url) {
      console.log(`SKIP  ${profile.username} - avatar already exists`);
      continue;
    }

    const avatarUrl = buildWorldResidentAvatarUrl({
      username: profile?.username ?? row.persona_name,
      displayName: profile?.display_name ?? row.persona_name,
      residentRole: row.resident_role ?? "general_user",
      countryCode: row.country_code ?? "",
      region: row.region ?? "",
    });

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
      })
      .eq("id", row.profile_id);

    if (updateError) {
      console.error(`FAIL  ${profile?.username}`, updateError);
      continue;
    }

    console.log(`OK    ${profile?.username} -> ${avatarUrl}`);
    updated++;
  }

  console.log("");
  console.log(`Updated avatars: ${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
