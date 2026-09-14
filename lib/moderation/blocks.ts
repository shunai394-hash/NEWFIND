import { lookupNamedWorldResident } from "@/lib/ai/named-world-residents";
import { isAiResidentUsername } from "@/lib/moderation/client";
import { createAdminClient } from "@/lib/supabase/admin";

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /user_blocks|schema cache|42P01/i.test(message);
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);

  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(
    (row) => String((row as { blocked_id: string }).blocked_id),
  );
}

export async function isBlocked(blockerId: string, blockedId: string) {
  const ids = await listBlockedIds(blockerId);
  return ids.includes(blockedId);
}

async function isAiResidentProfile(profileId: string) {
  try {
    const db = createAdminClient();
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();

    if (profileError) {
      console.warn("[blocks] profile lookup failed", profileError.message);
    } else {
      const username = String(profile?.username ?? "");
      if (
        isAiResidentUsername(username) ||
        Boolean(lookupNamedWorldResident(username))
      ) {
        return true;
      }
    }

    const { data, error } = await db
      .from("ai_personas")
      .select("id")
      .eq("profile_id", profileId)
      .limit(1);

    if (error) {
      console.warn("[blocks] AI resident check failed", error.message);
      return false;
    }

    return Boolean(data?.[0]);
  } catch (error) {
    console.warn("[blocks] AI resident check failed", error);
    return false;
  }
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new Error("自分自身をブロックすることはできません");
  }

  if (await isAiResidentProfile(blockedId)) {
    throw new Error("AI住民をブロックすることはできません");
  }

  const db = createAdminClient();

  const { error } = await db.from("user_blocks").upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
    },
    {
      onConflict: "blocker_id,blocked_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  await db
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},followee_id.eq.${blockedId}),and(follower_id.eq.${blockedId},followee_id.eq.${blockerId})`,
    );

  return { blocked: true };
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await createAdminClient()
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  if (error) {
    throw new Error(error.message);
  }

  return { blocked: false };
}