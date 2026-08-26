import { engagementScore, rankForYouFeed } from "@/lib/feed-rank";
import { filterDiscoveryPosts } from "@/lib/products/discovery-filter";
import { mediaTypeFromFile } from "@/lib/media";
import {
  EMPTY_SOCIAL_LINKS,
  type SocialLinks,
} from "@/lib/social-links";
import {
  ANDROID_OAUTH_CALLBACK,
  isAndroidCapacitor,
} from "@/lib/capacitor/platform";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/store/types";

function logSupabaseError(scope: string, error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null, extra?: Record<string, unknown>) {
  if (!error) return;
  console.error("[Supabase]", scope, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    ...extra,
  });
}
import type {
  CategoryId,
  CommentView,
  CreatePostInput,
  FollowListEntry,
  Post,
  PostView,
  Profile,
  Session,
  UpdateProfileInput,
  VisualKind,
} from "@/lib/types";
import { VISUAL_KINDS } from "@/lib/types";

function isVisualKind(value: string | null | undefined): value is VisualKind {
  return Boolean(value && (VISUAL_KINDS as readonly string[]).includes(value));
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  account_type: Profile["accountType"];
  company_name: string | null;
  company_website: string | null;
  company_description: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  created_at: string;
};

type PostRow = {
  id: string;
  author_id: string;
  media_type: Post["mediaType"];
  media_url: string;
  thumbnail_url: string | null;
  caption: string;
  category: Post["category"];
  product_url: string | null;
  product_label: string | null;
  is_sponsored: boolean;
  source: Post["source"];
  source_ref: string | null;
  source_url: string | null;
  japan_context?: string | null;
  visual_kind?: string | null;
  featured_person?: string | null;
  featured_credit?: string | null;
  created_at: string;
};

let socialColumnsReady: boolean | null = null;

function mapProfile(row: ProfileRow, social?: SocialLinks | null): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    accountType: row.account_type,
    companyName: row.company_name,
    companyWebsite: row.company_website,
    companyDescription: row.company_description,
    instagramUrl: row.instagram_url ?? social?.instagramUrl ?? null,
    xUrl: row.x_url ?? social?.xUrl ?? null,
    tiktokUrl: row.tiktok_url ?? social?.tiktokUrl ?? null,
    youtubeUrl: row.youtube_url ?? social?.youtubeUrl ?? null,
    websiteUrl: row.website_url ?? social?.websiteUrl ?? null,
    createdAt: row.created_at,
  };
}

function socialPath(userId: string) {
  return `profile-meta/${userId}.json`;
}

async function detectSocialColumns(
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  if (socialColumnsReady !== null) return socialColumnsReady;
  // Probe the column directly so an empty profiles table still reports ready
  // after migration 003 (select("*").limit(1) with no rows used to false-negative).
  const { error } = await supabase.from("profiles").select("instagram_url").limit(1);
  if (error) {
    const msg = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
    const missingColumn =
      error.code === "42703" ||
      msg.includes("instagram_url") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache");
    socialColumnsReady = !missingColumn;
    return socialColumnsReady;
  }
  socialColumnsReady = true;
  return true;
}

async function loadSocialFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<SocialLinks> {
  const { data } = supabase.storage.from("media").getPublicUrl(socialPath(userId));
  try {
    const res = await fetch(`${data.publicUrl}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { ...EMPTY_SOCIAL_LINKS };
    const json = (await res.json()) as Partial<SocialLinks>;
    return {
      instagramUrl: json.instagramUrl ?? null,
      xUrl: json.xUrl ?? null,
      tiktokUrl: json.tiktokUrl ?? null,
      youtubeUrl: json.youtubeUrl ?? null,
      websiteUrl: json.websiteUrl ?? null,
    };
  } catch {
    return { ...EMPTY_SOCIAL_LINKS };
  }
}

async function saveSocialFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  links: SocialLinks,
) {
  const body = new Blob([JSON.stringify(links)], { type: "application/json" });
  const { error } = await supabase.storage
    .from("media")
    .upload(socialPath(userId), body, {
      upsert: true,
      contentType: "application/json",
      cacheControl: "60",
    });
  if (error) throw new Error(error.message);
}

async function hydrateProfile(
  supabase: ReturnType<typeof createClient>,
  row: ProfileRow,
): Promise<Profile> {
  const hasCols = await detectSocialColumns(supabase);
  const mapped = mapProfile(row);
  if (hasCols) {
    const hasDbSocial = Boolean(
      mapped.instagramUrl ||
        mapped.xUrl ||
        mapped.tiktokUrl ||
        mapped.youtubeUrl ||
        mapped.websiteUrl,
    );
    if (hasDbSocial) return mapped;
    // Migration just applied: keep reading older Storage fallback until DB is filled.
    const social = await loadSocialFallback(supabase, row.id);
    return mapProfile(row, social);
  }
  const social = await loadSocialFallback(supabase, row.id);
  return mapProfile(row, social);
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption,
    category: row.category,
    productUrl: row.product_url,
    productLabel: row.product_label,
    isSponsored: row.is_sponsored,
    source: row.source,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    japanContext: row.japan_context ?? null,
    visualKind: isVisualKind(row.visual_kind) ? row.visual_kind : null,
    featuredPerson: row.featured_person ?? null,
    featuredCredit: row.featured_credit ?? null,
    createdAt: row.created_at,
  };
}

async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  displayName?: string,
) {
  const existing = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing.error) {
    logSupabaseError("ensureProfile.select", existing.error, {
      status: (existing as { status?: number }).status ?? null,
    });
  }
  if (existing.data) return hydrateProfile(supabase, existing.data as ProfileRow);

  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 16) || "user";
  let username = base;
  for (let i = 0; i < 20; i += 1) {
    const taken = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (!taken.data) break;
    username = `${base}${i + 1}`;
  }

  const inserted = await supabase
    .from("profiles")
    .insert({
      id: userId,
      username,
      display_name: displayName?.trim() || username,
      bio: "",
      account_type: "personal",
    })
    .select("*")
    .single();

  if (inserted.error) {
    logSupabaseError("ensureProfile.insert", inserted.error, {
      status: (inserted as { status?: number }).status ?? null,
    });
    const retry = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (retry.error) {
      logSupabaseError("ensureProfile.retry", retry.error, {
        status: (retry as { status?: number }).status ?? null,
      });
    }
    if (retry.data) return hydrateProfile(supabase, retry.data as ProfileRow);
    throw new Error(inserted.error.message);
  }
  return hydrateProfile(supabase, inserted.data as ProfileRow);
}

async function selectByIds<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  ids: string[],
  idColumn = "post_id",
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40);
    const { data, error } = await supabase.from(table).select(columns).in(idColumn, slice);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

async function hydratePostsLight(
  supabase: ReturnType<typeof createClient>,
  posts: Post[],
  viewerId: string | null,
): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const profilesRows = await selectByIds<ProfileRow>(
    supabase,
    "profiles",
    "*",
    authorIds,
    "id",
  );
  const profiles = new Map(profilesRows.map((row) => [row.id, mapProfile(row)]));
  return posts.flatMap((post) => {
    const author = profiles.get(post.authorId);
    if (!author) return [];
    return [
      {
        ...post,
        author,
        likeCount: 0,
        wantCount: 0,
        commentCount: 0,
        saveCount: 0,
        shareCount: 0,
        liked: false,
        wanted: false,
        saved: false,
        followingAuthor: false,
      },
    ];
  });
}

async function hydratePosts(
  supabase: ReturnType<typeof createClient>,
  posts: Post[],
  viewerId: string | null,
): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.authorId))];

  const [
    profilesRows,
    likeCounts,
    wantCounts,
    saveCounts,
    commentCounts,
    shareCounts,
    viewerLikes,
    viewerWants,
    viewerSaves,
  ] = await Promise.all([
    selectByIds<ProfileRow>(supabase, "profiles", "*", authorIds, "id"),
    countByPostIds(supabase, "likes", ids),
    countByPostIds(supabase, "wants", ids),
    countByPostIds(supabase, "saves", ids),
    countByPostIds(supabase, "comments", ids),
    countByPostIds(supabase, "shares", ids),
    viewerId ? viewerJoinedPostIds(supabase, "likes", viewerId, ids) : Promise.resolve(new Set<string>()),
    viewerId ? viewerJoinedPostIds(supabase, "wants", viewerId, ids) : Promise.resolve(new Set<string>()),
    viewerId ? viewerJoinedPostIds(supabase, "saves", viewerId, ids) : Promise.resolve(new Set<string>()),
  ]);

  let following = new Set<string>();
  if (viewerId && authorIds.length > 0) {
    const followRows: Array<{ followee_id: string }> = [];
    for (let i = 0; i < authorIds.length; i += 40) {
      const slice = authorIds.slice(i, i + 40);
      const { data, error } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId)
        .in("followee_id", slice);
      if (error) throw new Error(error.message);
      followRows.push(...((data ?? []) as Array<{ followee_id: string }>));
    }
    following = new Set(followRows.map((r) => r.followee_id));
  }

  const profiles = new Map(profilesRows.map((row) => [row.id, mapProfile(row)]));

  return posts.flatMap((post) => {
    const author = profiles.get(post.authorId);
    if (!author) return [];
    return [
      {
        ...post,
        author,
        likeCount: likeCounts.get(post.id) ?? 0,
        wantCount: wantCounts.get(post.id) ?? 0,
        commentCount: commentCounts.get(post.id) ?? 0,
        saveCount: saveCounts.get(post.id) ?? 0,
        shareCount: shareCounts.get(post.id) ?? 0,
        liked: viewerId ? viewerLikes.has(post.id) : false,
        wanted: viewerId ? viewerWants.has(post.id) : false,
        saved: viewerId ? viewerSaves.has(post.id) : false,
        followingAuthor: viewerId ? following.has(post.authorId) : false,
      },
    ];
  });
}

async function countByPostIds(
  supabase: ReturnType<typeof createClient>,
  table: "likes" | "wants" | "saves" | "comments" | "shares",
  postIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const concurrency = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < postIds.length) {
      const index = cursor++;
      const postId = postIds[index]!;
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      if (error) throw new Error(`${table}.count: ${error.message}`);
      map.set(postId, count ?? 0);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(postIds.length, 1)) }, () => worker()),
  );
  return map;
}

async function viewerJoinedPostIds(
  supabase: ReturnType<typeof createClient>,
  table: "likes" | "wants" | "saves",
  viewerId: string,
  postIds: string[],
): Promise<Set<string>> {
  const set = new Set<string>();
  for (let i = 0; i < postIds.length; i += 40) {
    const slice = postIds.slice(i, i + 40);
    const { data, error } = await supabase
      .from(table)
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", slice);
    if (error) throw new Error(`${table}.viewer: ${error.message}`);
    for (const row of (data ?? []) as Array<{ post_id: string }>) {
      set.add(row.post_id);
    }
  }
  return set;
}

function score(view: PostView) {
  return engagementScore(view);
}

export const supabaseStore: Store = {
  async getSession() {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) return null;
      return { userId: user.id, email: user.email ?? "" };
    } catch {
      return null;
    }
  },

  async signInEmail(email, password) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session?.user) {
      throw new Error(error?.message || "ログインに失敗しました");
    }
    const user = data.session.user;
    return { userId: user.id, email: user.email ?? email };
  },

  async signUpEmail(email, password, displayName) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw new Error(error.message);
    if (!data.session?.user) {
      throw new Error(
        "確認メールを送信しました。メール内のリンクを開いてからログインしてください。",
      );
    }
    const user = data.session.user;
    return { userId: user.id, email: user.email ?? email };
  },

  async signInOAuth(provider, next = "/") {
    const supabase = createClient();
    // Android Capacitor: custom scheme so the system browser can return into the app.
    // Web / iOS keep the same-origin /auth/callback route (server exchangeCodeForSession).
    const redirectTo = isAndroidCapacitor()
      ? new URL(ANDROID_OAUTH_CALLBACK)
      : new URL("/auth/callback", window.location.origin);
    if (next.startsWith("/") && !next.startsWith("//")) {
      redirectTo.searchParams.set("next", next);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  async getProfile(id) {
    const supabase = createClient();
    const { data, error, status } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) {
      logSupabaseError("getProfile", error, { status });
      throw new Error(error.message);
    }
    return data ? hydrateProfile(supabase, data as ProfileRow) : null;
  },

  async ensureMyProfile(session) {
    const supabase = createClient();
    return ensureProfile(supabase, session.userId, session.email);
  },

  async getProfileByUsername(username) {
    const key = username.trim();
    if (!key) return null;
    const supabase = createClient();
    const exact = await supabase.from("profiles").select("*").eq("username", key).maybeSingle();
    if (exact.error) {
      logSupabaseError("getProfileByUsername", exact.error, {
        status: (exact as { status?: number }).status ?? null,
      });
      throw new Error(exact.error.message);
    }
    if (exact.data) return hydrateProfile(supabase, exact.data as ProfileRow);

    const lowered = key.toLowerCase();
    if (lowered !== key) {
      const again = await supabase.from("profiles").select("*").eq("username", lowered).maybeSingle();
      if (again.error) throw new Error(again.error.message);
      if (again.data) return hydrateProfile(supabase, again.data as ProfileRow);
    }
    return null;
  },

  async updateProfile(id, patch: UpdateProfileInput) {
    const supabase = createClient();
    const payload: Record<string, unknown> = {};
    if (patch.username !== undefined) payload.username = patch.username;
    if (patch.displayName !== undefined) payload.display_name = patch.displayName;
    if (patch.bio !== undefined) payload.bio = patch.bio;
    if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl;
    if (patch.accountType !== undefined) payload.account_type = patch.accountType;
    if (patch.companyName !== undefined) payload.company_name = patch.companyName;
    if (patch.companyWebsite !== undefined) payload.company_website = patch.companyWebsite;
    if (patch.companyDescription !== undefined) {
      payload.company_description = patch.companyDescription;
    }

    const socialPatch: SocialLinks = {
      instagramUrl: patch.instagramUrl === undefined ? null : patch.instagramUrl,
      xUrl: patch.xUrl === undefined ? null : patch.xUrl,
      tiktokUrl: patch.tiktokUrl === undefined ? null : patch.tiktokUrl,
      youtubeUrl: patch.youtubeUrl === undefined ? null : patch.youtubeUrl,
      websiteUrl: patch.websiteUrl === undefined ? null : patch.websiteUrl,
    };
    const hasSocialPatch =
      patch.instagramUrl !== undefined ||
      patch.xUrl !== undefined ||
      patch.tiktokUrl !== undefined ||
      patch.youtubeUrl !== undefined ||
      patch.websiteUrl !== undefined;

    const hasCols = await detectSocialColumns(supabase);
    if (hasCols && hasSocialPatch) {
      if (patch.instagramUrl !== undefined) payload.instagram_url = patch.instagramUrl;
      if (patch.xUrl !== undefined) payload.x_url = patch.xUrl;
      if (patch.tiktokUrl !== undefined) payload.tiktok_url = patch.tiktokUrl;
      if (patch.youtubeUrl !== undefined) payload.youtube_url = patch.youtubeUrl;
      if (patch.websiteUrl !== undefined) payload.website_url = patch.websiteUrl;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Storage JSON is legacy-only: required when columns are missing; best-effort mirror otherwise.
    if (hasSocialPatch && !hasCols) {
      await saveSocialFallback(supabase, id, socialPatch);
    } else if (hasSocialPatch && hasCols) {
      await saveSocialFallback(supabase, id, socialPatch).catch(() => undefined);
    }

    return hydrateProfile(supabase, data as ProfileRow);
  },

  async getFeed(kind, viewerId, offset = 0, pageLimit = 24) {
    const supabase = createClient();
    const forYouWindow = 96;
    const fetchLimit = kind === "foryou" ? forYouWindow : pageLimit;
    const fetchOffset = kind === "foryou" ? 0 : offset;
    let query = supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(fetchOffset, fetchOffset + fetchLimit - 1);

    if (kind === "following") {
      if (!viewerId) {
        return { posts: [], hasMore: false, nextOffset: 0 };
      }
      const { data: follows } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId);
      const ids = (follows ?? []).map((f) => f.followee_id);
      if (ids.length === 0) {
        return { posts: [], hasMore: false, nextOffset: 0 };
      }
      query = query.in("author_id", ids);
    }

    const { data, error } = await query;
    if (error) {
      logSupabaseError("getFeed", error);
      throw new Error(error.message);
    }
    const posts = ((data ?? []) as PostRow[]).map(mapPost);
    const light = await hydratePostsLight(supabase, posts, viewerId);
    let views = light;
    try {
      views = await Promise.race([
        hydratePosts(supabase, posts, viewerId),
        new Promise<PostView[]>((_, reject) => {
          setTimeout(() => reject(new Error("hydrate timeout")), 8000);
        }),
      ]);
    } catch (err) {
      console.warn("[getFeed] using light hydrate", err);
    }
    const ranked =
      kind === "foryou" ? rankForYouFeed(filterDiscoveryPosts(views)) : views;
    const pagePosts = kind === "foryou" ? ranked.slice(offset, offset + pageLimit) : ranked;
    const hasMore =
      kind === "foryou" ? offset + pageLimit < ranked.length : posts.length === pageLimit;
    return {
      posts: pagePosts,
      hasMore,
      nextOffset: offset + pagePosts.length,
    };
  },

  async getPost(id, viewerId) {
    const supabase = createClient();
    const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const [view] = await hydratePosts(supabase, [mapPost(data as PostRow)], viewerId);
    return view ?? null;
  },

  async createPost(authorId, input: CreatePostInput) {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      author_id: authorId,
      media_type: input.mediaType,
      media_url: input.mediaUrl,
      thumbnail_url: input.thumbnailUrl ?? null,
      caption: input.caption,
      category: input.category,
      product_url: input.productUrl || null,
      product_label: input.productLabel || null,
      is_sponsored: Boolean(input.isSponsored),
      source: input.source ?? "user",
      source_ref: input.sourceRef || null,
      source_url: input.sourceUrl || null,
    };
    if (input.japanContext) payload.japan_context = input.japanContext;
    if (input.visualKind) payload.visual_kind = input.visualKind;
    if (input.featuredPerson) payload.featured_person = input.featuredPerson;
    if (input.featuredCredit) payload.featured_credit = input.featuredCredit;

    let { data, error } = await supabase.from("posts").insert(payload).select("*").single();
    if (error && /japan_context|visual_kind|featured_person|featured_credit|schema cache|42703/i.test(error.message)) {
      delete payload.japan_context;
      delete payload.visual_kind;
      delete payload.featured_person;
      delete payload.featured_credit;
      const retry = await supabase.from("posts").insert(payload).select("*").single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const [view] = await hydratePosts(supabase, [mapPost(data as PostRow)], authorId);
    if (!view) throw new Error("投稿の作成に失敗しました");
    return view;
  },

  async uploadMedia(file) {
    const supabase = createClient();
    const type = mediaTypeFromFile(file);
    const ext = file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return { url: data.publicUrl, type };
  },

  async toggleLike(postId, userId) {
    return toggleJoin("likes", postId, userId);
  },

  async toggleWant(postId, userId) {
    return toggleJoin("wants", postId, userId);
  },

  async toggleSave(postId, userId) {
    return toggleJoin("saves", postId, userId);
  },

  async sharePost(postId, userId) {
    const supabase = createClient();
    const { error } = await supabase.from("shares").insert({
      post_id: postId,
      user_id: userId,
    });
    if (error) throw new Error(error.message);
  },

  async addComment(postId, userId, body) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: userId, body: body.trim() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error("プロフィールが見つかりません");
    return {
      id: data.id,
      userId: data.user_id,
      postId: data.post_id,
      body: data.body,
      createdAt: data.created_at,
      author: profile,
    } satisfies CommentView;
  },

  async listComments(postId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("*").in("id", userIds)
      : { data: [] };
    const map = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, mapProfile(p)]));
    return rows.flatMap((row) => {
      const author = map.get(row.user_id);
      return author
        ? [
            {
              id: row.id,
              userId: row.user_id,
              postId: row.post_id,
              body: row.body,
              createdAt: row.created_at,
              author,
            },
          ]
        : [];
    });
  },

  async isFollowing(followerId, followeeId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("followee_id", followeeId)
      .maybeSingle();
    return Boolean(data);
  },

  async toggleFollow(followeeId, followerId) {
    if (followeeId === followerId) throw new Error("自分はフォローできません");
    const supabase = createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("followee_id", followeeId)
      .maybeSingle();
    if (data) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("followee_id", followeeId);
      if (error) throw new Error(error.message);
      return false;
    }
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: followerId, followee_id: followeeId });
    if (error) throw new Error(error.message);
    return true;
  },

  async getSaved(userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("saves")
      .select("post_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.post_id);
    if (ids.length === 0) return [];
    const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
    return hydratePosts(supabase, ((posts ?? []) as PostRow[]).map(mapPost), userId);
  },

  async getUserPosts(userId, viewerId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      logSupabaseError("getUserPosts", error, {
        status: (error as { status?: number }).status ?? null,
      });
      return [];
    }
    try {
      return await hydratePosts(supabase, ((data ?? []) as PostRow[]).map(mapPost), viewerId);
    } catch (err) {
      console.error("[newfind] hydratePosts", err);
      return [];
    }
  },

  async search(query, viewerId) {
    const q = query.trim();
    if (!q) return { users: [], posts: [] };
    const supabase = createClient();
    const like = `%${q}%`;
    const [usersRes, postsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.${like},display_name.ilike.${like},company_name.ilike.${like}`),
      supabase.from("posts").select("*").ilike("caption", like),
    ]);
    const posts = await hydratePosts(
      supabase,
      ((postsRes.data ?? []) as PostRow[]).map(mapPost),
      viewerId,
    );
    return {
      users: ((usersRes.data ?? []) as ProfileRow[]).map((row) => mapProfile(row)),
      posts: filterDiscoveryPosts(posts),
    };
  },

  async trending(viewerId, offset = 0, pageLimit = 24) {
    return this.getFeed("foryou", viewerId, offset, pageLimit);
  },

  async newFinds(viewerId, offset = 0, pageLimit = 24) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageLimit - 1);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as PostRow[]).map(mapPost);
    const posts = filterDiscoveryPosts(await hydratePosts(supabase, rows, viewerId));
    return {
      posts,
      hasMore: rows.length === pageLimit,
      nextOffset: offset + rows.length,
    };
  },

  async byCategory(category: CategoryId, viewerId, offset = 0, pageLimit = 24) {
    const supabase = createClient();
    const fetchLimit = pageLimit * 3;
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .range(offset, offset + fetchLimit - 1);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as PostRow[]).map(mapPost);
    const posts = filterDiscoveryPosts(await hydratePosts(supabase, rows, viewerId)).slice(
      0,
      pageLimit,
    );
    return {
      posts,
      hasMore: rows.length === fetchLimit,
      nextOffset: offset + rows.length,
    };
  },

  async getFollowCounts(userId) {
    const supabase = createClient();
    const [followers, following] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
      supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    if (followers.error) logSupabaseError("getFollowCounts.followers", followers.error);
    if (following.error) logSupabaseError("getFollowCounts.following", following.error);
    return {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
    };
  },

  async listFollowers(userId, viewerId) {
    const supabase = createClient();
    const followerIds = await listFollowColumnIds(supabase, "follower_id", "followee_id", userId);
    return hydrateFollowList(supabase, followerIds, viewerId);
  },

  async listFollowing(userId, viewerId) {
    const supabase = createClient();
    const followeeIds = await listFollowColumnIds(supabase, "followee_id", "follower_id", userId);
    return hydrateFollowList(supabase, followeeIds, viewerId);
  },
};

async function listFollowColumnIds(
  supabase: ReturnType<typeof createClient>,
  selectColumn: "follower_id" | "followee_id",
  filterColumn: "follower_id" | "followee_id",
  userId: string,
): Promise<string[]> {
  // Stable order + page size under PostgREST max-rows so counts match full lists.
  const ids: string[] = [];
  const seen = new Set<string>();
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("follows")
      .select(selectColumn)
      .eq(filterColumn, userId)
      .order(selectColumn, { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, string>>;
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

function stubFollowProfile(id: string): Profile {
  return {
    id,
    username: `user_${id.replace(/-/g, "").slice(0, 10)}`,
    displayName: "ユーザー",
    bio: "",
    avatarUrl: null,
    accountType: "personal",
    companyName: null,
    companyWebsite: null,
    companyDescription: null,
    instagramUrl: null,
    xUrl: null,
    tiktokUrl: null,
    youtubeUrl: null,
    websiteUrl: null,
    createdAt: new Date(0).toISOString(),
  };
}

async function hydrateFollowList(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  viewerId: string | null,
): Promise<FollowListEntry[]> {
  if (userIds.length === 0) return [];
  const profilesRows = await selectByIds<ProfileRow>(supabase, "profiles", "*", userIds, "id");
  const profiles = new Map(profilesRows.map((row) => [row.id, mapProfile(row)]));

  let followingSet = new Set<string>();
  if (viewerId) {
    const rows: Array<{ followee_id: string }> = [];
    for (let i = 0; i < userIds.length; i += 40) {
      const slice = userIds.slice(i, i + 40);
      const { data, error } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId)
        .in("followee_id", slice);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as Array<{ followee_id: string }>));
    }
    followingSet = new Set(rows.map((r) => r.followee_id));
  }

  // Preserve one entry per follow edge so list length matches getFollowCounts.
  const entries: FollowListEntry[] = [];
  for (const id of userIds) {
    const profile = profiles.get(id) ?? stubFollowProfile(id);
    entries.push({
      profile,
      following: followingSet.has(id),
    });
  }
  return entries.sort((a, b) =>
    a.profile.displayName.localeCompare(b.profile.displayName, "ja"),
  );
}

async function toggleJoin(
  table: "likes" | "wants" | "saves",
  postId: string,
  userId: string,
) {
  const supabase = createClient();
  const { data } = await supabase
    .from(table)
    .select("user_id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();
  if (data) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId).eq("post_id", postId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from(table).insert({ user_id: userId, post_id: postId });
  if (error) throw new Error(error.message);
  return true;
}
