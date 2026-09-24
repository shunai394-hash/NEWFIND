import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createAdminClient } from "@/lib/supabase/admin";
import {
  SPECIALIST_PRODUCT_HUNTERS,
  SPECIALIST_PRODUCT_HUNTER_PERSONA_NAMES,
  SPECIALIST_PRODUCT_HUNTER_USERNAMES,
} from "@/lib/ai/specialist-product-hunters";

async function main() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_personas")
    .select(`
      id,
      profile_id,
      persona_name,
      resident_role,
      is_active,
      expertise,
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

  const rows = (data ?? []).map((row: {
    id: string;
    profile_id: string;
    persona_name: string;
    resident_role: string | null;
    is_active: boolean;
    expertise: string[] | null;
    profiles?: {
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    } | Array<{
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    }>;
  }) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      persona_id: row.id,
      profile_id: row.profile_id,
      persona_name: row.persona_name,
      resident_role: row.resident_role,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      expertise: row.expertise ?? [],
    };
  });

  const expectedNames = new Set(SPECIALIST_PRODUCT_HUNTER_PERSONA_NAMES);
  const expectedUsernames = new Set(SPECIALIST_PRODUCT_HUNTER_USERNAMES);
  const hunters = rows.filter(
    (row) =>
      expectedNames.has(row.persona_name) ||
      (row.username ? expectedUsernames.has(row.username) : false),
  );

  const duplicates = hunters.filter((row, index) =>
    hunters.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        (other.persona_name === row.persona_name ||
          (row.username && other.username === row.username)),
    ),
  );

  const missing = SPECIALIST_PRODUCT_HUNTERS.filter((spec) => {
    return !hunters.some(
      (row) =>
        row.persona_name === spec.personaName ||
        row.username === spec.username,
    );
  });

  const missingAvatars = hunters.filter((row) => !row.avatar_url);
  const wrongRole = hunters.filter(
    (row) => row.resident_role !== "product_hunter",
  );

  console.log("Active AI residents:", rows.length);
  console.log("Expected specialist hunters:", SPECIALIST_PRODUCT_HUNTERS.length);
  console.log("Found specialist hunters:", hunters.length);
  console.table(
    hunters.map((row) => ({
      persona_name: row.persona_name,
      username: row.username,
      display_name: row.display_name,
      resident_role: row.resident_role,
      avatar: row.avatar_url ? "yes" : "MISSING",
    })),
  );

  if (missing.length) {
    console.log(
      "Missing hunters:",
      missing.map((spec) => `${spec.personaName} (${spec.username})`).join(", "),
    );
  } else {
    console.log("Missing hunters: none");
  }

  if (duplicates.length) {
    console.log(
      "Duplicate hunter rows:",
      duplicates.map((row) => `${row.persona_name} / ${row.username}`).join(", "),
    );
  } else {
    console.log("Duplicate hunter rows: none");
  }

  if (missingAvatars.length) {
    console.log(
      "Hunters missing avatar_url:",
      missingAvatars.map((row) => row.persona_name).join(", "),
    );
  } else {
    console.log("Hunters missing avatar_url: none");
  }

  if (wrongRole.length) {
    console.log(
      "Hunters with wrong role:",
      wrongRole
        .map((row) => `${row.persona_name}=${row.resident_role}`)
        .join(", "),
    );
  }

  const ok =
    missing.length === 0 &&
    duplicates.length === 0 &&
    missingAvatars.length === 0 &&
    wrongRole.length === 0 &&
    hunters.length === SPECIALIST_PRODUCT_HUNTERS.length;

  console.log("");
  console.log(ok ? "CHECK PASSED" : "CHECK FAILED");
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
