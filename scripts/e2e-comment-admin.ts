/**
 * Prove comment + parent_comment_id round-trip via service role.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createAdminClient } from "../lib/supabase/admin";
import { threadComments } from "../lib/comments/thread";

async function main() {
  const admin = createAdminClient();

  const { data: post, error: postError } = await admin
    .from("posts")
    .select("id, author_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (postError || !post) throw new Error(postError?.message || "no posts");

  const userId = post.author_id as string;
  const stamp = Date.now();

  const { data: root, error: rootError } = await admin
    .from("comments")
    .insert({
      post_id: post.id,
      user_id: userId,
      body: `Admin E2E root ${stamp}`,
      parent_comment_id: null,
    })
    .select("id, parent_comment_id, body")
    .single();
  if (rootError) throw new Error(`root insert: ${rootError.message}`);

  const { data: reply, error: replyError } = await admin
    .from("comments")
    .insert({
      post_id: post.id,
      user_id: userId,
      body: `Admin E2E reply ${stamp}`,
      parent_comment_id: root.id,
    })
    .select("id, parent_comment_id, body")
    .single();
  if (replyError) throw new Error(`reply insert: ${replyError.message}`);

  const { data: listed, error: listError } = await admin
    .from("comments")
    .select("id, parent_comment_id, body")
    .eq("post_id", post.id)
    .in("id", [root.id, reply.id]);
  if (listError) throw new Error(listError.message);

  const threads = threadComments(
    (listed ?? []).map((row) => ({
      id: String(row.id),
      parentCommentId: (row.parent_comment_id as string | null) ?? null,
    })),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        postId: post.id,
        rootId: root.id,
        replyId: reply.id,
        replyParent: reply.parent_comment_id,
        threadRoots: threads.length,
        nestedReplies: threads[0]?.replies?.length ?? 0,
      },
      null,
      2,
    ),
  );

  // cleanup
  await admin.from("comments").delete().in("id", [reply.id, root.id]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
