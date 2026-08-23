import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

async function listIds(sb, selectColumn, filterColumn, userId) {
  const ids = [];
  const seen = new Set();
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("follows")
      .select(selectColumn)
      .eq(filterColumn, userId)
      .order(selectColumn, { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const id = row[selectColumn];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (rows.length < page) break;
  }
  return ids;
}

const env = loadEnv();
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const username = process.argv[2] || "nfdemo_jp_palecloset";
const { data: p, error } = await sb
  .from("profiles")
  .select("id,username")
  .eq("username", username)
  .maybeSingle();
if (error) throw error;
if (!p) {
  console.error("not found", username);
  process.exit(1);
}

const [followersCount, followingCount] = await Promise.all([
  sb
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followee_id", p.id),
  sb
    .from("follows")
    .select("followee_id", { count: "exact", head: true })
    .eq("follower_id", p.id),
]);

const followerIds = await listIds(sb, "follower_id", "followee_id", p.id);
const followeeIds = await listIds(sb, "followee_id", "follower_id", p.id);

const result = {
  username,
  followers: {
    count: followersCount.count,
    listed: followerIds.length,
    match: followersCount.count === followerIds.length,
  },
  following: {
    count: followingCount.count,
    listed: followeeIds.length,
    match: followingCount.count === followeeIds.length,
  },
};
console.log(JSON.stringify(result, null, 2));
if (!result.followers.match || !result.following.match) process.exit(2);
