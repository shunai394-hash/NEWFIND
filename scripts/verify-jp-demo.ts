/**
 * Verify Japan demo seed integrity (in-memory + optional DB after apply).
 *
 *   npm run seed:demo:verify
 *   npm run seed:demo:verify -- --db
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SEED_JP_AUTH_PROFILES,
  SEED_JP_POSTS,
  SEED_JP_PROFILES,
  jpSeedStats,
} from "../lib/seed-jp";

function loadEnv() {
  const map = new Map<string, string>();
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return map;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(line.slice(0, eq).trim(), value);
  }
  return map;
}

function pct(n: number, d: number) {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function fail(msg: string, issues: string[]) {
  issues.push(msg);
}

async function countIn(
  admin: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  chunk = 80,
) {
  let total = 0;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .in(column, slice);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function verifyMemory(issues: string[]) {
  const stats = jpSeedStats();
  const photos = SEED_JP_POSTS.filter((p) => p.mediaType === "photo");
  const withMedia = SEED_JP_POSTS.filter((p) => Boolean(p.mediaUrl));
  const photoUrls = photos.map((p) => p.mediaUrl);
  const uniquePhotos = new Set(photoUrls).size;
  const mediaDupes = photoUrls.length - uniquePhotos;

  console.log("=== JP seed (memory) ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log(
    `withMedia=${withMedia.length}/${SEED_JP_POSTS.length} (${pct(withMedia.length, SEED_JP_POSTS.length)})`,
  );
  console.log(`uniquePhotos=${uniquePhotos}/${photos.length} reuse=${mediaDupes}`);

  if (SEED_JP_POSTS.length < 120) fail(`posts too few: ${SEED_JP_POSTS.length}`, issues);
  if (withMedia.length / SEED_JP_POSTS.length < 0.95) {
    fail(`too many posts without media: ${withMedia.length}/${SEED_JP_POSTS.length}`, issues);
  }
  if (mediaDupes !== 0) fail(`duplicate photo media_url: ${mediaDupes}`, issues);
  if (stats.likes < 800) fail(`likes too low: ${stats.likes}`, issues);
  if (stats.comments < 80) fail(`comments too low: ${stats.comments}`, issues);
  if (stats.follows < 300) fail(`follows too low: ${stats.follows}`, issues);
  if (stats.followFollowers.min < 1) {
    fail(`followers min too low: ${stats.followFollowers.min}`, issues);
  }
  if (stats.followFollowers.max < 15) {
    fail(`followers max too low: ${stats.followFollowers.max}`, issues);
  }
  if (stats.followFollowers.max > 80) {
    fail(`followers max too high for demo list UX: ${stats.followFollowers.max}`, issues);
  }
  if (stats.followFollowing.min < 1) {
    fail(`following min too low: ${stats.followFollowing.min}`, issues);
  }
  if ((stats.selfFollows ?? 0) > 0) fail(`self-follows present: ${stats.selfFollows}`, issues);
  if ((stats.duplicateFollows ?? 0) > 0) {
    fail(`duplicate follows: ${stats.duplicateFollows}`, issues);
  }
  if ((stats.selfLikes ?? 0) > 0) fail(`self-likes present: ${stats.selfLikes}`, issues);
  if ((stats.snsUsers ?? 0) < 20) fail(`sns users too few: ${stats.snsUsers}`, issues);
  if ((stats.likesPerPost?.max ?? 0) < 20) {
    fail(`like max too low: ${stats.likesPerPost?.max}`, issues);
  }
  if ((stats.reactors ?? 0) < 50) fail(`reactors too few: ${stats.reactors}`, issues);
  const noAvatarReactors = SEED_JP_AUTH_PROFILES.filter(
    (p) => p.username.startsWith("nfdemo_jp_rx") && !p.avatarUrl,
  ).length;
  if (noAvatarReactors > 0) {
    fail(`reactors missing avatar: ${noAvatarReactors}`, issues);
  }
  const fashionProducts = SEED_JP_POSTS.filter(
    (p) => p.category === "fashion" && p.productLabel && p.productLabel !== "商品を見る",
  ).length;
  if (fashionProducts < 40) {
    fail(`fashion product-linked posts too few: ${fashionProducts}`, issues);
  }

  const fashionShare =
    ((stats.categories as Record<string, number>).fashion ?? 0) / SEED_JP_POSTS.length;
  if (fashionShare < 0.3) {
    fail(`fashion share too low: ${pct((stats.categories as Record<string, number>).fashion ?? 0, SEED_JP_POSTS.length)}`, issues);
  }

  const badPlace = SEED_JP_POSTS.filter((p) =>
    /東京駅|場所は|夜景の記録/.test(p.caption),
  ).length;
  if (badPlace > 0) fail(`suspicious place/night captions: ${badPlace}`, issues);

  for (const need of ["fashion", "beauty", "food", "home", "lifestyle"]) {
    const n = (stats.categories as Record<string, number>)[need] ?? 0;
    if (n < 8) fail(`category underrepresented: ${need}=${n}`, issues);
  }
}

async function verifyDb(issues: string[]) {
  const env = loadEnv();
  const url = env.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    fail("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", issues);
    return;
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jpPostIds = SEED_JP_POSTS.map((p) => p.id);
  const jpAuthIds = SEED_JP_AUTH_PROFILES.map((p) => p.id);

  const [likes, comments, saves, wants, follows] = await Promise.all([
    countIn(admin, "likes", "post_id", jpPostIds),
    countIn(admin, "comments", "post_id", jpPostIds),
    countIn(admin, "saves", "post_id", jpPostIds),
    countIn(admin, "wants", "post_id", jpPostIds),
    countIn(admin, "follows", "follower_id", jpAuthIds),
  ]);

  const posts: Array<{ id: string; media_url: string; media_type: string; category: string }> =
    [];
  for (let i = 0; i < jpPostIds.length; i += 80) {
    const slice = jpPostIds.slice(i, i + 80);
    const { data, error } = await admin
      .from("posts")
      .select("id,media_url,media_type,category")
      .in("id", slice);
    if (error) {
      fail(`posts query: ${error.message}`, issues);
      break;
    }
    posts.push(...((data ?? []) as typeof posts));
  }

  const { count: profileCount, error: profileErr } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .like("username", "nfdemo_jp_%");
  if (profileErr) fail(`profiles count: ${profileErr.message}`, issues);

  let snsUsers = 0;
  for (let i = 0; i < SEED_JP_PROFILES.length; i += 80) {
    const slice = SEED_JP_PROFILES.slice(i, i + 80).map((p) => p.id);
    const { data, error } = await admin
      .from("profiles")
      .select("instagram_url,x_url,tiktok_url,youtube_url,website_url")
      .in("id", slice);
    if (error) {
      fail(`sns query: ${error.message}`, issues);
      break;
    }
    for (const row of data ?? []) {
      if (
        row.instagram_url ||
        row.x_url ||
        row.tiktok_url ||
        row.youtube_url ||
        row.website_url
      ) {
        snsUsers += 1;
      }
    }
  }

  const followerVals: number[] = [];
  const followingVals: number[] = [];
  for (const profile of SEED_JP_PROFILES) {
    const [a, b] = await Promise.all([
      admin
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", profile.id),
      admin
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
    ]);
    followerVals.push(a.count ?? 0);
    followingVals.push(b.count ?? 0);
  }
  followerVals.sort((a, b) => a - b);
  followingVals.sort((a, b) => a - b);

  const likeVals: number[] = [];
  for (const post of SEED_JP_POSTS) {
    const { count } = await admin
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);
    likeVals.push(count ?? 0);
  }
  likeVals.sort((a, b) => a - b);

  // Sample self-follow / self-like integrity on a subset.
  const sampleFollowees = SEED_JP_PROFILES.slice(0, 20).map((p) => p.id);
  const { data: selfFollowRows } = await admin
    .from("follows")
    .select("follower_id,followee_id")
    .in("followee_id", sampleFollowees);
  const selfFollows = (selfFollowRows ?? []).filter(
    (r) => r.follower_id === r.followee_id,
  ).length;

  const photos = posts.filter((p) => p.media_type === "photo");
  const uniquePhotos = new Set(photos.map((p) => p.media_url)).size;
  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  const report = {
    dbJpProfiles: profileCount ?? 0,
    dbJpPosts: posts.length,
    dbPhotos: photos.length,
    uniquePhotos,
    photoReuse: photos.length - uniquePhotos,
    likes,
    comments,
    follows,
    saves,
    wants,
    snsUsers,
    followers: {
      min: followerVals[0] ?? 0,
      max: followerVals[followerVals.length - 1] ?? 0,
      avg: avg(followerVals),
    },
    following: {
      min: followingVals[0] ?? 0,
      max: followingVals[followingVals.length - 1] ?? 0,
      avg: avg(followingVals),
    },
    likesPerPost: {
      min: likeVals[0] ?? 0,
      max: likeVals[likeVals.length - 1] ?? 0,
      avg: avg(likeVals),
    },
    sampleSelfFollows: selfFollows,
  };

  console.log("=== JP seed (DB) ===");
  console.log(JSON.stringify(report, null, 2));

  if (posts.length !== SEED_JP_POSTS.length) {
    fail(`DB posts ${posts.length} != seed ${SEED_JP_POSTS.length}`, issues);
  }
  if (photos.length - uniquePhotos !== 0) {
    fail(`DB photo URL reuse ${photos.length - uniquePhotos}`, issues);
  }
  if (likes < 800) fail(`DB likes too low ${likes}`, issues);
  if (comments < 150) fail(`DB comments too low ${comments}`, issues);
  if (follows < 400) fail(`DB follows too low ${follows}`, issues);
  if (selfFollows > 0) fail(`DB self-follows ${selfFollows}`, issues);
  if (snsUsers < 20) fail(`DB sns users too few ${snsUsers}`, issues);
  if ((followerVals[0] ?? 0) < 1) {
    fail(`DB followers min too low ${followerVals[0]}`, issues);
  }
  if ((followingVals[0] ?? 0) < 1) {
    fail(`DB following min too low ${followingVals[0]}`, issues);
  }
  if ((followerVals[followerVals.length - 1] ?? 0) > 80) {
    fail(`DB followers max too high ${followerVals[followerVals.length - 1]}`, issues);
  }
}

async function main() {
  const withDb = process.argv.includes("--db");
  const issues: string[] = [];
  await verifyMemory(issues);
  if (withDb) await verifyDb(issues);

  if (issues.length > 0) {
    console.error("\nVERIFY FAILED:");
    for (const issue of issues) console.error(` - ${issue}`);
    process.exit(1);
  }
  console.log("\nVERIFY OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
