import { createAdminClient } from "@/lib/supabase/admin";
import { mediaObjectPath } from "@/lib/media-storage";
import { APPLE_REVOKE_URL } from "@/lib/apple/config";
import { createAppleClientSecret } from "@/lib/apple/client-secret";

const STORAGE_REMOVE_CHUNK = 100;

export type DeleteOwnedAccountResult = {
  ok: true;
  warning?: string;
};

function uniquePaths(paths: Array<string | null>): string[] {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

async function collectOwnedMediaPaths(userId: string) {
  const admin = createAdminClient();
  const [profile, posts] = await Promise.all([
    admin.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
    admin.from("posts").select("media_url, thumbnail_url").eq("author_id", userId),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (posts.error) throw new Error(posts.error.message);

  return uniquePaths([
    mediaObjectPath(profile.data?.avatar_url),
    ...(posts.data ?? []).flatMap((post) => [
      mediaObjectPath(post.media_url),
      mediaObjectPath(post.thumbnail_url),
    ]),
    `profile-meta/${userId}.json`,
  ]);
}

async function removeOwnedMedia(paths: string[]) {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  const errors: string[] = [];
  for (const group of chunk(paths, STORAGE_REMOVE_CHUNK)) {
    const { error } = await admin.storage.from("media").remove(group);
    if (error) errors.push(error.message);
  }
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}

/**
 * Deletes one user owned by `userId`.
 * Callers must already have verified the actor is that user (self-delete)
 * or an admin deleting someone else.
 *
 * Auth user delete cascades to profiles and related public tables.
 * Storage objects are not cascaded, so they are removed first.
 */
export async function deleteOwnedAccount(userId: string): Promise<DeleteOwnedAccountResult> {
  const id = userId.trim();
  if (!id) throw new Error("invalid user");

  let warning: string | undefined;
  const admin = createAdminClient();

  // Revoke the Apple provider token before deleting the account record.
  const { data: appleIdentity, error: appleIdentityError } = await admin
    .from("apple_identities")
    .select("refresh_token, client_id")
    .eq("user_id", id)
    .maybeSingle();

  if (appleIdentityError) {
    console.error("[account-delete] Apple identity lookup failed", appleIdentityError.message);
    warning = "Appleとの連携解除を確認できませんでした。必要に応じてサポートへお問い合わせください。";
  } else if (appleIdentity?.refresh_token && appleIdentity?.client_id) {
    try {
      const clientSecret = await createAppleClientSecret(appleIdentity.client_id);
      const body = new URLSearchParams({
        client_id: appleIdentity.client_id,
        client_secret: clientSecret,
        token: appleIdentity.refresh_token,
        token_type_hint: "refresh_token",
      });
      const response = await fetch(APPLE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Apple token revocation failed");
      }
    } catch (error) {
      console.error("[account-delete] Apple token revocation failed", error);
      warning = "Appleとの連携解除を完了できませんでした。アカウントは削除します。";
    }
  } else if (appleIdentity) {
    warning = "Appleとの連携トークンを確認できませんでした。アカウントは削除します。";
  }

  try {
    await removeOwnedMedia(await collectOwnedMediaPaths(id));
  } catch (error) {
    warning =
      error instanceof Error
        ? `アカウントは削除しますが、一部の画像ファイルを削除できませんでした: ${error.message}`
        : "アカウントは削除しますが、一部の画像ファイルを削除できませんでした";
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  return warning ? { ok: true, warning } : { ok: true };
}
