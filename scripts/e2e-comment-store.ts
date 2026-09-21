/**
 * Store-level comment + reply check (no browser).
 * Uses getStore() against the configured backend.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getStore, storeMode } from "../lib/store";
import { threadComments } from "../lib/comments/thread";

async function main() {
  const store = getStore();
  console.log("storeMode", storeMode());

  const session = await store.getSession();
  let userId = session?.userId ?? null;

  if (!userId && storeMode() === "local") {
    const signed = await store.signInEmail("nfdemo_mei@nfdemo.invalid", "demo");
    userId = signed.userId;
  }

  const feed = await store.getFeed("foryou", userId, 0, 8);
  const post = feed.posts[0];
  if (!post) throw new Error("No post in feed to comment on");

  console.log("post", post.id, "comments", post.commentCount);

  if (!userId) {
    const listed = await store.listComments(post.id);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "list-only",
          listed: listed.length,
          note: "No session — open sheet path can list; write needs login",
        },
        null,
        2,
      ),
    );
    return;
  }

  const root = await store.addComment(
    post.id,
    userId,
    `Store E2E root ${Date.now()}`,
    null,
  );
  const reply = await store.addComment(
    post.id,
    userId,
    `@${root.author.username} Store E2E reply ${Date.now()}`,
    root.id,
  );

  const listed = await store.listComments(post.id);
  const threads = threadComments(listed);
  const foundReply = listed.find((c) => c.id === reply.id);

  if (!foundReply || foundReply.parentCommentId !== root.id) {
    throw new Error("Reply parent_comment_id not persisted");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "write+reply",
        postId: post.id,
        rootId: root.id,
        replyId: reply.id,
        parentCommentId: foundReply.parentCommentId,
        threadRoots: threads.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
