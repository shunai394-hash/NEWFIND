import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createAdminClient } from "@/lib/supabase/admin";

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
    console.error(error);
    process.exit(1);
  }

  const rows = (data ?? []).map((row: any) => ({
    persona_id: row.id,
    profile_id: row.profile_id,
    persona_name: row.persona_name,
    resident_role: row.resident_role,
    country_code: row.country_code,
    region: row.region,
    username: row.profiles?.username,
    display_name: row.profiles?.display_name,
    avatar_url: row.profiles?.avatar_url,
    avatar_missing: !row.profiles?.avatar_url,
  }));

  console.table(rows);

  const missing = rows.filter((row) => row.avatar_missing);

  console.log("");
  console.log(`Active AI residents: ${rows.length}`);
  console.log(`Missing avatars: ${missing.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
