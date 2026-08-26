import { createAdminClient } from "@/lib/supabase/admin";

type AppleUserInput = {
  appleUserId: string;
  email: string | null;
  isPrivateEmail: boolean;
  displayName: string | null;
};

type AuthUserLite = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

async function lookupAuthUserByEmail(email: string): Promise<AuthUserLite | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { users?: AuthUserLite[] };
  const users = json.users ?? [];
  const lowered = email.toLowerCase();
  return (
    users.find((user) => user.email?.toLowerCase() === lowered) ??
    users[0] ??
    null
  );
}

async function lookupByAppleId(appleUserId: string): Promise<string | null> {
  const admin = createAdminClient();
  const identity = await admin
    .from("apple_identities")
    .select("user_id")
    .eq("apple_user_id", appleUserId)
    .maybeSingle();
  if (!identity.error && identity.data?.user_id) {
    return identity.data.user_id as string;
  }

  const profile = await admin
    .from("profiles")
    .select("id")
    .eq("apple_user_id", appleUserId)
    .maybeSingle();
  if (!profile.error && profile.data?.id) {
    return profile.data.id as string;
  }
  return null;
}

async function rememberAppleIdentity(
  userId: string,
  input: AppleUserInput,
) {
  const admin = createAdminClient();
  try {
    await admin.from("apple_identities").upsert(
      {
        apple_user_id: input.appleUserId,
        user_id: userId,
        email: input.email,
        is_private_email: input.isPrivateEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "apple_user_id" },
    );
  } catch {
    // Table may not exist until migration 004 is applied.
  }

  try {
    await admin.from("profiles").update({ apple_user_id: input.appleUserId }).eq("id", userId);
  } catch {
    // Column may not exist until migration 004 is applied.
  }

  if (input.displayName?.trim()) {
    try {
      await admin
        .from("profiles")
        .update({ display_name: input.displayName.trim() })
        .eq("id", userId);
    } catch {
      // ignore
    }
  }

  try {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        apple_user_id: input.appleUserId,
        apple_is_private_email: input.isPrivateEmail,
        ...(input.displayName ? { display_name: input.displayName } : {}),
      },
    });
  } catch {
    // ignore
  }
}

function fallbackEmail(appleUserId: string) {
  const safe = appleUserId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "user";
  return `apple.${safe}@privaterelay.appleid.com`;
}

export async function findOrCreateAppleUser(input: AppleUserInput) {
  const admin = createAdminClient();
  const existingId = await lookupByAppleId(input.appleUserId);
  if (existingId) {
    const existing = await admin.auth.admin.getUserById(existingId);
    const email = existing.data.user?.email || input.email || fallbackEmail(input.appleUserId);
    await rememberAppleIdentity(existingId, { ...input, email });
    return { userId: existingId, email, created: false };
  }

  const email = input.email?.trim() || fallbackEmail(input.appleUserId);
  const byEmail = await lookupAuthUserByEmail(email);
  if (byEmail?.id) {
    await rememberAppleIdentity(byEmail.id, { ...input, email: byEmail.email || email });
    return { userId: byEmail.id, email: byEmail.email || email, created: false };
  }

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      apple_user_id: input.appleUserId,
      apple_is_private_email: input.isPrivateEmail,
      display_name: input.displayName || undefined,
    },
    app_metadata: {
      provider: "apple",
      providers: ["apple"],
    },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || "Apple ユーザーの作成に失敗しました");
  }

  await rememberAppleIdentity(created.data.user.id, { ...input, email });
  return { userId: created.data.user.id, email, created: true };
}

export async function issueAppleLoginTicket(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(error?.message || "セッションの発行に失敗しました");
  }
  return data.properties.hashed_token as string;
}
