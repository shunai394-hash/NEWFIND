import { createAdminClient } from "@/lib/supabase/admin";
import { mediaObjectPath } from "@/lib/media-storage";

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
  try {
    await removeOwnedMedia(await collectOwnedMediaPaths(id));
  } catch (error) {
    warning =
      error instanceof Error
        ? `アカウントは削除しますが、一部の画像ファイルを削除できませんでした: ${error.message}`
        : "アカウントは削除しますが、一部の画像ファイルを削除できませんでした";
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  return warning ? { ok: true, warning } : { ok: true };
}
