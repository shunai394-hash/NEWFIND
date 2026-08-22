/**
 * Upsert NEWFIND demo rows into Supabase without touching real users or posts.
 *
 * Dry-run (default):
 *   npm run seed:demo
 *
 * Apply (demo rows only):
 *   npm run seed:demo:apply
 *
 * Remove demo rows only (never real data):
 *   npx tsx scripts/seed-demo.ts --purge-demo-only --apply
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEMO_COMMENT_ID_PREFIX,
  DEMO_EMAIL_DOMAIN,
  DEMO_POST_ID_PREFIX,
  DEMO_PROFILE_ID_PREFIX,
  DEMO_USERNAME_PREFIX,
  SEED_COMMENTS,
  SEED_FOLLOWS,
  SEED_LIKES,
  SEED_POSTS,
  SEED_PROFILES,
  SEED_SAVES,
  SEED_WANTS,
  demoEmail,
  isDemoCommentId,
  isDemoPostId,
  isDemoProfileId,
  isDemoUsername,
} from "../lib/seed";

type Flags = {
  apply: boolean;
  purge: boolean;
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseFlags(argv: string[]): Flags {
  return {
    apply: argv.includes("--apply"),
    purge: argv.includes("--purge-demo-only"),
  };
}

function assertDemoOnlyPayload() {
  for (const profile of SEED_PROFILES) {
    if (!isDemoProfileId(profile.id) || !isDemoUsername(profile.username)) {
      throw new Error(`Refusing non-demo profile: ${profile.id} ${profile.username}`);
    }
  }
  for (const post of SEED_POSTS) {
    if (!isDemoPostId(post.id) || !isDemoProfileId(post.authorId)) {
      throw new Error(`Refusing non-demo post: ${post.id}`);
    }
  }
  for (const follow of SEED_FOLLOWS) {
    if (!isDemoProfileId(follow.followerId) || !isDemoProfileId(follow.followeeId)) {
      throw new Error("Refusing non-demo follow");
    }
  }
  for (const row of [...SEED_LIKES, ...SEED_WANTS, ...SEED_SAVES]) {
    if (!isDemoProfileId(row.userId) || !isDemoPostId(row.postId)) {
      throw new Error("Refusing non-demo reaction");
    }
  }
  for (const comment of SEED_COMMENTS) {
    if (
      !isDemoCommentId(comment.id) ||
      !isDemoProfileId(comment.userId) ||
      !isDemoPostId(comment.postId)
    ) {
      throw new Error(`Refusing non-demo comment: ${comment.id}`);
    }
  }
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SERVICE_ROLE_KEY?.trim();

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL が .env.local にありません");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。ダミー投入には service role が必要です。",
    );
  }
  if (key.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY に anon/publishable key が設定されています");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function chunked<T>(
  items: T[],
  size: number,
  fn: (slice: T[]) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

function throwIfError(scope: string, error: { message?: string } | null) {
  if (error) throw new Error(`${scope}: ${error.message}`);
}

async function ensureAuthUsers(admin: SupabaseClient) {
  for (const profile of SEED_PROFILES) {
    const email = demoEmail(profile.username);
    const password = process.env.SEED_DEMO_PASSWORD || "NewfindDemo!seed";
    const { error } = await admin.auth.admin.createUser({
      id: profile.id,
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: profile.displayName,
        seed: "nfdemo",
      },
    });
    if (!error) continue;
    const message = error.message.toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists") ||
      message.includes("duplicate")
    ) {
      continue;
    }
    throw new Error(`auth.createUser ${profile.username}: ${error.message}`);
  }
}

async function upsertDemo(admin: SupabaseClient) {
  await ensureAuthUsers(admin);

  const profiles = SEED_PROFILES.map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.displayName,
    bio: p.bio,
    avatar_url: p.avatarUrl,
    account_type: p.accountType,
    company_name: p.companyName,
    company_website: p.companyWebsite,
    company_description: p.companyDescription,
    created_at: p.createdAt,
  }));
  const { error: profileError } = await admin.from("profiles").upsert(profiles, {
    onConflict: "id",
  });
  throwIfError("profiles.upsert", profileError);

  await chunked(SEED_POSTS, 40, async (slice) => {
    const rows = slice.map((p) => ({
      id: p.id,
      author_id: p.authorId,
      media_type: p.mediaType,
      media_url: p.mediaUrl,
      thumbnail_url: p.thumbnailUrl,
      caption: p.caption,
      category: p.category,
      product_url: p.productUrl,
      product_label: p.productLabel,
      is_sponsored: p.isSponsored,
      source: p.source,
      source_ref: p.sourceRef,
      source_url: p.sourceUrl,
      created_at: p.createdAt,
    }));
    const { error } = await admin.from("posts").upsert(rows, { onConflict: "id" });
    throwIfError("posts.upsert", error);
  });

  await chunked(SEED_FOLLOWS, 80, async (slice) => {
    const rows = slice.map((f) => ({
      follower_id: f.followerId,
      followee_id: f.followeeId,
    }));
    const { error } = await admin.from("follows").upsert(rows, {
      onConflict: "follower_id,followee_id",
    });
    throwIfError("follows.upsert", error);
  });

  await chunked(SEED_LIKES, 80, async (slice) => {
    const rows = slice.map((r) => ({ user_id: r.userId, post_id: r.postId }));
    const { error } = await admin.from("likes").upsert(rows, {
      onConflict: "user_id,post_id",
    });
    throwIfError("likes.upsert", error);
  });

  await chunked(SEED_WANTS, 80, async (slice) => {
    const rows = slice.map((r) => ({ user_id: r.userId, post_id: r.postId }));
    const { error } = await admin.from("wants").upsert(rows, {
      onConflict: "user_id,post_id",
    });
    throwIfError("wants.upsert", error);
  });

  await chunked(SEED_SAVES, 80, async (slice) => {
    const rows = slice.map((r) => ({ user_id: r.userId, post_id: r.postId }));
    const { error } = await admin.from("saves").upsert(rows, {
      onConflict: "user_id,post_id",
    });
    throwIfError("saves.upsert", error);
  });

  await chunked(SEED_COMMENTS, 80, async (slice) => {
    const rows = slice.map((c) => ({
      id: c.id,
      user_id: c.userId,
      post_id: c.postId,
      body: c.body,
      created_at: c.createdAt,
    }));
    const { error } = await admin.from("comments").upsert(rows, { onConflict: "id" });
    throwIfError("comments.upsert", error);
  });
}

async function purgeDemoOnly(admin: SupabaseClient) {
  throwIfError(
    "comments.delete",
    (
      await admin
        .from("comments")
        .delete()
        .or(
          `id.like.${DEMO_COMMENT_ID_PREFIX}%,user_id.like.${DEMO_PROFILE_ID_PREFIX}%,post_id.like.${DEMO_POST_ID_PREFIX}%`,
        )
    ).error,
  );
  for (const table of ["likes", "wants", "saves"] as const) {
    throwIfError(
      `${table}.delete`,
      (
        await admin
          .from(table)
          .delete()
          .or(`user_id.like.${DEMO_PROFILE_ID_PREFIX}%,post_id.like.${DEMO_POST_ID_PREFIX}%`)
      ).error,
    );
  }
  throwIfError(
    "follows.delete",
    (
      await admin
        .from("follows")
        .delete()
        .or(
          `follower_id.like.${DEMO_PROFILE_ID_PREFIX}%,followee_id.like.${DEMO_PROFILE_ID_PREFIX}%`,
        )
    ).error,
  );
  throwIfError(
    "posts.delete",
    (await admin.from("posts").delete().like("id", `${DEMO_POST_ID_PREFIX}%`)).error,
  );
  throwIfError(
    "profiles.delete",
    (
      await admin
        .from("profiles")
        .delete()
        .like("id", `${DEMO_PROFILE_ID_PREFIX}%`)
        .like("username", `${DEMO_USERNAME_PREFIX}%`)
    ).error,
  );

  for (const profile of SEED_PROFILES) {
    if (!isDemoProfileId(profile.id) || !isDemoUsername(profile.username)) continue;
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(`auth.deleteUser ${profile.username}: ${error.message}`);
    }
  }
}

function printPlan(flags: Flags) {
  const brandbridge = SEED_POSTS.filter((p) => p.source === "brandbridge").length;
  const sponsored = SEED_POSTS.filter((p) => p.isSponsored).length;
  const withProduct = SEED_POSTS.filter((p) => p.productUrl).length;
  console.log("NEWFIND demo seed");
  console.log(`  mode        : ${flags.apply ? "APPLY" : "dry-run"}`);
  console.log(`  action      : ${flags.purge ? "purge-demo-only" : "upsert-demo-only"}`);
  console.log(`  username    : ${DEMO_USERNAME_PREFIX}*`);
  console.log(`  email       : *@${DEMO_EMAIL_DOMAIN}`);
  console.log(`  profiles    : ${SEED_PROFILES.length}`);
  console.log(`  posts       : ${SEED_POSTS.length}`);
  console.log(`  follows     : ${SEED_FOLLOWS.length}`);
  console.log(`  likes       : ${SEED_LIKES.length}`);
  console.log(`  wants       : ${SEED_WANTS.length}`);
  console.log(`  saves       : ${SEED_SAVES.length}`);
  console.log(`  comments    : ${SEED_COMMENTS.length}`);
  console.log(`  productUrl  : ${withProduct}`);
  console.log(`  sponsored   : ${sponsored}`);
  console.log(`  brandbridge : ${brandbridge}`);
  console.log(`  sample users: ${SEED_PROFILES.slice(0, 5).map((p) => p.username).join(", ")}`);
}

async function main() {
  loadEnvLocal();
  const flags = parseFlags(process.argv.slice(2));
  assertDemoOnlyPayload();
  printPlan(flags);

  if (!flags.apply) {
    console.log("No writes. Re-run with --apply to upsert demo rows only.");
    return;
  }

  const admin = createAdmin();

  if (flags.purge) {
    await purgeDemoOnly(admin);
    console.log("Purged demo rows only.");
    return;
  }

  await upsertDemo(admin);
  console.log("Upserted demo rows only. Real users/posts were not deleted.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
