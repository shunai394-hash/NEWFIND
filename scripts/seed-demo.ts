/**
 * Upsert NEWFIND demo rows into Supabase without touching real users or posts.
 *
 * Dry-run (default):
 *   npm run seed:demo
 *
 * Apply overseas + Japan demo (upsert only):
 *   npm run seed:demo:apply
 *
 * Purge overseas demo only (a0000000 / nfdemo_* except jp):
 *   npx tsx scripts/seed-demo.ts --purge-demo-only --apply
 *
 * Purge Japan demo only (nfdemo_jp_*):
 *   npx tsx scripts/seed-demo.ts --purge-jp-only --apply
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
import {
  DEMO_JP_COMMENT_ID_PREFIX,
  DEMO_JP_POST_ID_PREFIX,
  DEMO_JP_PROFILE_ID_PREFIX,
  DEMO_JP_REACTOR_ID_PREFIX,
  DEMO_JP_USERNAME_PREFIX,
  SEED_JP_AUTH_PROFILES,
  SEED_JP_COMMENTS,
  SEED_JP_FOLLOWS,
  SEED_JP_LIKES,
  SEED_JP_POSTS,
  SEED_JP_PROFILES,
  SEED_JP_SAVES,
  SEED_JP_WANTS,
  isDemoJpCommentId,
  isDemoJpPostId,
  isDemoJpProfileId,
  isDemoJpUsername,
  jpSeedStats,
} from "../lib/seed-jp";
import type { Comment, Post, Profile } from "../lib/types";

type Flags = {
  apply: boolean;
  purgeOverseas: boolean;
  purgeJp: boolean;
};

function parseEnvLocal(): Map<string, string> {
  const map = new Map<string, string>();
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
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
    map.set(key, value);
  }
  return map;
}

function envLocal(name: string) {
  return parseEnvLocal().get(name)?.trim() || process.env[name]?.trim() || "";
}

function keyKind(value: string) {
  if (!value) return "missing";
  if (value.startsWith("sb_publishable_")) return "publishable";
  if (value.startsWith("sb_secret_")) return "secret";
  if (value.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"),
      ) as { role?: string };
      return payload.role === "service_role" ? "jwt:service_role" : `jwt:${payload.role || "unknown"}`;
    } catch {
      return "jwt:unparsed";
    }
  }
  return "other";
}

function parseFlags(argv: string[]): Flags {
  return {
    apply: argv.includes("--apply"),
    purgeOverseas: argv.includes("--purge-demo-only"),
    purgeJp: argv.includes("--purge-jp-only"),
  };
}

function assertDemoOnlyPayload() {
  for (const profile of SEED_PROFILES) {
    if (!isDemoProfileId(profile.id) || !isDemoUsername(profile.username) || isDemoJpUsername(profile.username)) {
      throw new Error(`Refusing non-overseas-demo profile: ${profile.id} ${profile.username}`);
    }
  }
  for (const post of SEED_POSTS) {
    if (!isDemoPostId(post.id) || !isDemoProfileId(post.authorId)) {
      throw new Error(`Refusing non-demo post: ${post.id}`);
    }
  }
  for (const profile of SEED_JP_AUTH_PROFILES) {
    if (!isDemoJpProfileId(profile.id) || !isDemoJpUsername(profile.username)) {
      throw new Error(`Refusing non-jp-demo profile: ${profile.id} ${profile.username}`);
    }
  }
  for (const post of SEED_JP_POSTS) {
    if (!isDemoJpPostId(post.id) || !isDemoJpProfileId(post.authorId)) {
      throw new Error(`Refusing non-jp-demo post: ${post.id}`);
    }
  }
  for (const follow of [...SEED_FOLLOWS, ...SEED_JP_FOLLOWS]) {
    const ok =
      (isDemoProfileId(follow.followerId) && isDemoProfileId(follow.followeeId)) ||
      (isDemoJpProfileId(follow.followerId) && isDemoJpProfileId(follow.followeeId));
    if (!ok) throw new Error("Refusing non-demo follow");
  }
  for (const row of [...SEED_LIKES, ...SEED_WANTS, ...SEED_SAVES]) {
    if (!isDemoProfileId(row.userId) || !isDemoPostId(row.postId)) {
      throw new Error("Refusing non-demo reaction");
    }
  }
  for (const row of [...SEED_JP_LIKES, ...SEED_JP_WANTS, ...SEED_JP_SAVES]) {
    if (!isDemoJpProfileId(row.userId) || !isDemoJpPostId(row.postId)) {
      throw new Error("Refusing non-jp-demo reaction");
    }
  }
  for (const comment of SEED_COMMENTS) {
    if (!isDemoCommentId(comment.id) || !isDemoProfileId(comment.userId) || !isDemoPostId(comment.postId)) {
      throw new Error(`Refusing non-demo comment: ${comment.id}`);
    }
  }
  for (const comment of SEED_JP_COMMENTS) {
    if (
      !isDemoJpCommentId(comment.id) ||
      !isDemoJpProfileId(comment.userId) ||
      !isDemoJpPostId(comment.postId)
    ) {
      throw new Error(`Refusing non-jp-demo comment: ${comment.id}`);
    }
  }
}

function createAdmin() {
  const url = envLocal("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = envLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const key = envLocal("SUPABASE_SERVICE_ROLE_KEY") || envLocal("SERVICE_ROLE_KEY");
  const kind = keyKind(key);

  if (!url || !url.startsWith("http")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL が .env.local にありません");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。ダミー投入には service role が必要です。",
    );
  }
  if (anonKey && key === anonKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が anon/publishable key と同じです");
  }
  if (kind === "publishable" || kind.startsWith("jwt:anon") || kind.startsWith("jwt:authenticated")) {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY が service role ではありません (${kind})`);
  }
  if (kind !== "secret" && kind !== "jwt:service_role") {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY の形式を確認してください (${kind})`);
  }

  console.log(`  client      : service_role (${kind})`);

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

async function chunked<T>(items: T[], size: number, fn: (slice: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

function throwIfError(scope: string, error: { message?: string } | null) {
  if (error) throw new Error(`${scope}: ${error.message}`);
}

async function ensureAuthUsers(admin: SupabaseClient, profiles: Profile[], seedTag: string) {
  const password = process.env.SEED_DEMO_PASSWORD || "NewfindDemo!seed";
  await chunked(profiles, 12, async (slice) => {
    await Promise.all(
      slice.map(async (profile) => {
        const email = demoEmail(profile.username);
        const { error } = await admin.auth.admin.createUser({
          id: profile.id,
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: profile.displayName,
            seed: seedTag,
          },
        });
        if (!error) return;
        const message = error.message.toLowerCase();
        if (
          message.includes("already") ||
          message.includes("registered") ||
          message.includes("exists") ||
          message.includes("duplicate")
        ) {
          return;
        }
        throw new Error(`auth.createUser ${profile.username}: ${error.message}`);
      }),
    );
  });
}

function profileRows(profiles: Profile[]) {
  return profiles.map((p) => ({
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
}

function postRows(posts: Post[]) {
  return posts.map((p) => ({
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
}

async function upsertBundle(
  admin: SupabaseClient,
  bundle: {
    label: string;
    profiles: Profile[];
    posts: Post[];
    follows: Array<{ followerId: string; followeeId: string }>;
    likes: Array<{ userId: string; postId: string }>;
    wants: Array<{ userId: string; postId: string }>;
    saves: Array<{ userId: string; postId: string }>;
    comments: Comment[];
    seedTag: string;
  },
) {
  console.log(`  upserting   : ${bundle.label}`);
  await ensureAuthUsers(admin, bundle.profiles, bundle.seedTag);

  await chunked(profileRows(bundle.profiles), 80, async (slice) => {
    const { error } = await admin.from("profiles").upsert(slice, { onConflict: "id" });
    throwIfError(`${bundle.label}.profiles.upsert`, error);
  });

  await chunked(postRows(bundle.posts), 40, async (slice) => {
    const { error } = await admin.from("posts").upsert(slice, { onConflict: "id" });
    throwIfError(`${bundle.label}.posts.upsert`, error);
  });

  await chunked(bundle.follows, 80, async (slice) => {
    const rows = slice.map((f) => ({
      follower_id: f.followerId,
      followee_id: f.followeeId,
    }));
    const { error } = await admin.from("follows").upsert(rows, {
      onConflict: "follower_id,followee_id",
    });
    throwIfError(`${bundle.label}.follows.upsert`, error);
  });

  for (const [table, rows] of [
    ["likes", bundle.likes],
    ["wants", bundle.wants],
    ["saves", bundle.saves],
  ] as const) {
    await chunked(rows, 120, async (slice) => {
      const mapped = slice.map((r) => ({ user_id: r.userId, post_id: r.postId }));
      const { error } = await admin.from(table).upsert(mapped, {
        onConflict: "user_id,post_id",
      });
      throwIfError(`${bundle.label}.${table}.upsert`, error);
    });
  }

  await chunked(bundle.comments, 80, async (slice) => {
    const rows = slice.map((c) => ({
      id: c.id,
      user_id: c.userId,
      post_id: c.postId,
      body: c.body,
      created_at: c.createdAt,
    }));
    const { error } = await admin.from("comments").upsert(rows, { onConflict: "id" });
    throwIfError(`${bundle.label}.comments.upsert`, error);
  });
}

async function upsertDemo(admin: SupabaseClient) {
  await upsertBundle(admin, {
    label: "overseas-demo",
    profiles: SEED_PROFILES,
    posts: SEED_POSTS,
    follows: SEED_FOLLOWS,
    likes: SEED_LIKES,
    wants: SEED_WANTS,
    saves: SEED_SAVES,
    comments: SEED_COMMENTS,
    seedTag: "nfdemo",
  });

  await upsertBundle(admin, {
    label: "japan-demo",
    profiles: SEED_JP_AUTH_PROFILES,
    posts: SEED_JP_POSTS,
    follows: SEED_JP_FOLLOWS,
    likes: SEED_JP_LIKES,
    wants: SEED_JP_WANTS,
    saves: SEED_JP_SAVES,
    comments: SEED_JP_COMMENTS,
    seedTag: "nfdemo_jp",
  });
}

async function purgeOverseasOnly(admin: SupabaseClient) {
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
    (await admin.from("profiles").delete().like("id", `${DEMO_PROFILE_ID_PREFIX}%`)).error,
  );

  for (const profile of SEED_PROFILES) {
    if (!isDemoProfileId(profile.id) || isDemoJpUsername(profile.username)) continue;
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(`auth.deleteUser ${profile.username}: ${error.message}`);
    }
  }
}

async function purgeJpOnly(admin: SupabaseClient) {
  throwIfError(
    "jp.comments.delete",
    (
      await admin
        .from("comments")
        .delete()
        .or(
          `id.like.${DEMO_JP_COMMENT_ID_PREFIX}%,user_id.like.${DEMO_JP_PROFILE_ID_PREFIX}%,user_id.like.${DEMO_JP_REACTOR_ID_PREFIX}%,post_id.like.${DEMO_JP_POST_ID_PREFIX}%`,
        )
    ).error,
  );
  for (const table of ["likes", "wants", "saves"] as const) {
    throwIfError(
      `jp.${table}.delete`,
      (
        await admin
          .from(table)
          .delete()
          .or(
            `user_id.like.${DEMO_JP_PROFILE_ID_PREFIX}%,user_id.like.${DEMO_JP_REACTOR_ID_PREFIX}%,post_id.like.${DEMO_JP_POST_ID_PREFIX}%`,
          )
      ).error,
    );
  }
  throwIfError(
    "jp.follows.delete",
    (
      await admin
        .from("follows")
        .delete()
        .or(
          `follower_id.like.${DEMO_JP_PROFILE_ID_PREFIX}%,followee_id.like.${DEMO_JP_PROFILE_ID_PREFIX}%`,
        )
    ).error,
  );
  throwIfError(
    "jp.posts.delete",
    (await admin.from("posts").delete().like("id", `${DEMO_JP_POST_ID_PREFIX}%`)).error,
  );
  throwIfError(
    "jp.profiles.visible.delete",
    (await admin.from("profiles").delete().like("id", `${DEMO_JP_PROFILE_ID_PREFIX}%`)).error,
  );
  throwIfError(
    "jp.profiles.reactors.delete",
    (await admin.from("profiles").delete().like("id", `${DEMO_JP_REACTOR_ID_PREFIX}%`)).error,
  );

  for (const profile of SEED_JP_AUTH_PROFILES) {
    if (!isDemoJpProfileId(profile.id) || !isDemoJpUsername(profile.username)) continue;
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(`auth.deleteUser ${profile.username}: ${error.message}`);
    }
  }
}

function printPlan(flags: Flags) {
  const jp = jpSeedStats();
  const overseasProduct = SEED_POSTS.filter((p) => p.productUrl).length;
  const overseasSponsored = SEED_POSTS.filter((p) => p.isSponsored).length;
  const overseasBb = SEED_POSTS.filter((p) => p.source === "brandbridge").length;

  console.log("NEWFIND demo seed");
  console.log(`  mode        : ${flags.apply ? "APPLY" : "dry-run"}`);
  console.log(
    `  action      : ${
      flags.purgeJp
        ? "purge-jp-only"
        : flags.purgeOverseas
          ? "purge-overseas-only"
          : "upsert overseas + japan demo"
    }`,
  );
  console.log(`  email       : *@${DEMO_EMAIL_DOMAIN}`);
  console.log("");
  console.log("  [overseas demo]");
  console.log(`  username    : ${DEMO_USERNAME_PREFIX}* (non-jp)`);
  console.log(`  profiles    : ${SEED_PROFILES.length}`);
  console.log(`  posts       : ${SEED_POSTS.length}`);
  console.log(`  productUrl  : ${overseasProduct}`);
  console.log(`  sponsored   : ${overseasSponsored}`);
  console.log(`  brandbridge : ${overseasBb}`);
  console.log("");
  console.log("  [japan demo]");
  console.log(`  username    : ${DEMO_JP_USERNAME_PREFIX}*`);
  console.log(`  profiles    : ${jp.profiles} (+ reactors ${jp.reactors})`);
  console.log(`  posts       : ${jp.posts}`);
  console.log(`  follows     : ${jp.follows}`);
  console.log(`  likes       : ${jp.likes}`);
  console.log(`  wants       : ${jp.wants}`);
  console.log(`  saves       : ${jp.saves}`);
  console.log(`  comments    : ${jp.comments}`);
  console.log(`  productUrl  : ${jp.productUrl}`);
  console.log(`  sponsored   : ${jp.sponsored}`);
  console.log(`  brandbridge : ${jp.brandbridge}`);
  console.log(`  categories  : ${JSON.stringify(jp.categories)}`);
  console.log(`  sample users: ${SEED_JP_PROFILES.slice(0, 5).map((p) => p.username).join(", ")}`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.purgeOverseas && flags.purgeJp) {
    throw new Error("--purge-demo-only と --purge-jp-only は同時指定できません");
  }
  assertDemoOnlyPayload();
  printPlan(flags);
  console.log(
    `  service key : ${keyKind(envLocal("SUPABASE_SERVICE_ROLE_KEY") || envLocal("SERVICE_ROLE_KEY"))}`,
  );

  if (!flags.apply) {
    console.log("No writes. Re-run with --apply to upsert demo rows only.");
    return;
  }

  const admin = createAdmin();

  if (flags.purgeJp) {
    await purgeJpOnly(admin);
    console.log("Purged Japan demo rows only. Overseas demo and real data were not deleted.");
    return;
  }

  if (flags.purgeOverseas) {
    await purgeOverseasOnly(admin);
    console.log("Purged overseas demo rows only. Japan demo and real data were not deleted.");
    return;
  }

  await upsertDemo(admin);
  const jp = jpSeedStats();
  console.log("");
  console.log("Upserted demo rows only. Real users/posts were not deleted.");
  console.log("Japan demo summary:");
  console.log(`  profiles    : ${jp.profiles}`);
  console.log(`  posts       : ${jp.posts}`);
  console.log(`  categories  : ${JSON.stringify(jp.categories)}`);
  console.log(`  productUrl  : ${jp.productUrl}`);
  console.log(`  sponsored   : ${jp.sponsored}`);
  console.log(`  brandbridge : ${jp.brandbridge}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
