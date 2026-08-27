import { createAdminClient } from "@/lib/supabase/admin";
import { mediaObjectPath } from "@/lib/media-storage";

export type DeletePostResult = {
  ok: boolean;
  status: number;
  error?: string;
  warning?: string;
};

export async function deletePostWithMedia(
  postId: string,
  actorId: string,
  isAdmin: boolean,
): Promise<DeletePostResult> {
  const id = postId.trim();
  if (!id) return { ok: false, status: 400, error: "invalid id" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("id, author_id, media_url, thumbnail_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, status: 400, error: error.message };
  if (!data) return { ok: false, status: 404, error: "not found" };
  if (!isAdmin && data.author_id !== actorId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const paths = [mediaObjectPath(data.media_url), mediaObjectPath(data.thumbnail_url)].filter(
    (path): path is string => Boolean(path),
  );

  let warning: string | undefined;
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from("media").remove(paths);
    if (storageError) {
      warning = `投稿は削除しましたが、画像ファイルの削除に失敗しました: ${storageError.message}`;
    }
  }

  const { error: deleteError } = await admin.from("posts").delete().eq("id", id);
  if (deleteError) return { ok: false, status: 400, error: deleteError.message };

  return { ok: true, status: 200, warning };
}
