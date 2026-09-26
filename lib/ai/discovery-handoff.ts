import { createAdminClient } from "@/lib/supabase/admin";
import type { DiscoveryCategory } from "@/lib/discovery/types";
import { logAiActivity } from "@/lib/ai/control-tower/activity-log";

const CATEGORY_EXPERTISE: Record<string, string[]> = {
  beauty: ["beauty", "fragrance", "cosmetics", "skincare", "haircare"],
  fragrance: ["fragrance", "beauty", "perfume"],
  food: ["food", "beverage", "snacks", "kitchen"],
  fashion: ["fashion", "accessories", "shoes", "bags"],
  accessories: ["fashion", "accessories", "shoes"],
  tech: ["tech", "gadgets", "electronics", "audio"],
  home: ["home", "interior", "lifestyle", "household"],
  sports: ["sports", "fitness", "training", "outdoor"],
  lifestyle: ["lifestyle", "culture", "home"],
  travel: ["travel", "outdoor"],
  japan_brand: ["japanese products", "japan", "craft"],
  other: [],
};

type PersonaRow = {
  id: string;
  profile_id: string;
  persona_name: string;
  resident_role: string | null;
  expertise: string[] | null;
  preferred_categories: string[] | null;
  interests: string[] | null;
  country_code: string | null;
};

function needlesFor(category: string, country: string | null) {
  const fromCategory = CATEGORY_EXPERTISE[category] ?? [];
  const extra = country ? [country.toLowerCase()] : [];
  return [...fromCategory, category, ...extra].map((item) => item.toLowerCase());
}

function haystack(row: PersonaRow) {
  return [
    row.resident_role,
    ...(row.expertise ?? []),
    ...(row.preferred_categories ?? []),
    ...(row.interests ?? []),
    row.country_code,
    row.persona_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreMatch(row: PersonaRow, category: string, country: string | null) {
  if (row.resident_role === "world_scout") return -1;
  const text = haystack(row);
  const keys = needlesFor(category, country);
  let score = 0;
  for (const key of keys) {
    if (key && text.includes(key)) score += 3;
  }
  if (country && (row.country_code || "").toUpperCase() === country.toUpperCase()) {
    score += 1;
  }
  if (row.resident_role === "product_hunter") score += 2;
  if (row.resident_role === "curator" || row.resident_role === "influencer") {
    score += 1;
  }
  return score;
}

export async function assignDiscoveryToResident(input: {
  productId: string;
  category: DiscoveryCategory | string;
  country: string | null;
  title: string;
  scoutName: string;
  runId?: string | null;
}): Promise<{ personaId: string; personaName: string } | null> {
  const admin = createAdminClient();
  const existing = await admin
    .from("discovery_products")
    .select("assigned_resident_id")
    .eq("id", input.productId)
    .maybeSingle();

  if (existing.error && /assigned_resident_id|42703/i.test(existing.error.message)) {
    return null;
  }
  if (existing.data?.assigned_resident_id) return null;

  const personas = await admin
    .from("ai_personas")
    .select(
      "id, profile_id, persona_name, resident_role, expertise, preferred_categories, interests, country_code",
    )
    .eq("is_active", true)
    .neq("resident_role", "world_scout")
    .limit(80);

  if (personas.error || !personas.data?.length) return null;

  const ranked = (personas.data as PersonaRow[])
    .map((row) => ({ row, score: scoreMatch(row, input.category, input.country) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const chosen = ranked[0]?.row;
  if (!chosen) return null;

  const update = await admin
    .from("discovery_products")
    .update({ assigned_resident_id: chosen.id })
    .eq("id", input.productId);

  if (update.error && /assigned_resident_id|42703/i.test(update.error.message)) {
    return null;
  }
  if (update.error) {
    console.warn("assignDiscoveryToResident failed", update.error.message);
    return null;
  }

  await logAiActivity({
    personaId: chosen.id,
    actorName: chosen.persona_name,
    actorRole: chosen.resident_role || "resident",
    action: "discovery_received",
    detail: `${input.title} from ${input.scoutName}`,
    relatedProductId: input.productId,
    relatedRunId: input.runId ?? null,
  });
  await logAiActivity({
    personaId: chosen.id,
    actorName: input.scoutName,
    actorRole: "world_scout",
    action: "handoff",
    detail: `${input.title} → ${chosen.persona_name}`,
    relatedProductId: input.productId,
    relatedRunId: input.runId ?? null,
  });

  return { personaId: chosen.id, personaName: chosen.persona_name };
}

export async function listAssignedDiscoveryResidentIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discovery_products")
    .select("assigned_resident_id")
    .not("assigned_resident_id", "is", null)
    .in("status", ["draft", "pending"]);

  if (error) {
    if (/assigned_resident_id|42703/i.test(error.message)) {
      return new Set();
    }
    throw new Error(error.message);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.assigned_resident_id)
      .filter((id): id is string => Boolean(id)),
  );
}

export async function listAssignedDiscoveries(personaId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discovery_products")
    .select(
      "id, brand, product_name, category, product_url, official_url, product_image_url, description, status, discovery_source, confidence_score, trend_score, attention_reason",
    )
    .eq("assigned_resident_id", personaId)
    .in("status", ["draft", "pending"])
    .order("discovered_at", { ascending: false })
    .limit(5);

  if (error) {
    if (/assigned_resident_id|42703/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}
