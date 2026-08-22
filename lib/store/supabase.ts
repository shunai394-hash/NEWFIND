import { mediaTypeFromFile } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/store/types";
import type {
  CategoryId,
  CommentView,
  CreatePostInput,
  Post,
  PostView,
  Profile,
  Session,
} from "@/lib/types";

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
  created_at: string;
};

function mapProfile(row: ProfileRow): Profile {
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
    createdAt: row.created_at,
  };
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
  if (existing.data) return mapProfile(existing.data as ProfileRow);

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
    const retry = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (retry.data) return mapProfile(retry.data as ProfileRow);
    throw new Error(inserted.error.message);
  }
  return mapProfile(inserted.data as ProfileRow);
}

async function hydratePosts(
  supabase: ReturnType<typeof createClient>,
  posts: Post[],
  viewerId: string | null,
): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.authorId))];

  const [profilesRes, likesRes, wantsRes, savesRes, commentsRes, sharesRes, followsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").in("id", authorIds),
      supabase.from("likes").select("user_id, post_id").in("post_id", ids),
      supabase.from("wants").select("user_id, post_id").in("post_id", ids),
      supabase.from("saves").select("user_id, post_id").in("post_id", ids),
      supabase.from("comments").select("id, post_id").in("post_id", ids),
      supabase.from("shares").select("id, post_id").in("post_id", ids),
      viewerId
        ? supabase
            .from("follows")
            .select("followee_id")
            .eq("follower_id", viewerId)
            .in("followee_id", authorIds)
        : Promise.resolve({ data: [] as Array<{ followee_id: string }> }),
    ]);

  const profiles = new Map(
    ((profilesRes.data ?? []) as ProfileRow[]).map((row) => [row.id, mapProfile(row)]),
  );
  const following = new Set(
    ((followsRes.data ?? []) as Array<{ followee_id: string }>).map((r) => r.followee_id),
  );

  return posts.flatMap((post) => {
    const author = profiles.get(post.authorId);
    if (!author) return [];
    const likes = (likesRes.data ?? []).filter((r) => r.post_id === post.id);
    const wants = (wantsRes.data ?? []).filter((r) => r.post_id === post.id);
    const saves = (savesRes.data ?? []).filter((r) => r.post_id === post.id);
    return [
      {
        ...post,
        author,
        likeCount: likes.length,
        wantCount: wants.length,
        commentCount: (commentsRes.data ?? []).filter((r) => r.post_id === post.id).length,
        saveCount: saves.length,
        shareCount: (sharesRes.data ?? []).filter((r) => r.post_id === post.id).length,
        liked: viewerId ? likes.some((r) => r.user_id === viewerId) : false,
        wanted: viewerId ? wants.some((r) => r.user_id === viewerId) : false,
        saved: viewerId ? saves.some((r) => r.user_id === viewerId) : false,
        followingAuthor: following.has(post.authorId),
      },
    ];
  });
}

function score(view: PostView) {
  return (
    Date.parse(view.createdAt) / 60000 +
    view.likeCount * 8 +
    view.wantCount * 12 +
    view.saveCount * 6 +
    view.commentCount * 4
  );
}

export const supabaseStore: Store = {
  async getSession() {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;

      if (!user) {
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        user = data.user ?? null;
      }

      if (!user) return null;

      try {
        await ensureProfile(supabase, user.id, user.email ?? "");
      } catch {
        // プロフィール未作成でも認証は維持する
      }

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
    try {
      await ensureProfile(supabase, user.id, user.email ?? email);
    } catch {
      // 認証は成功している
    }
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
    try {
      await ensureProfile(supabase, user.id, user.email ?? email, displayName);
    } catch {
      // 認証は成功している
    }
    return { userId: user.id, email: user.email ?? email };
  },

  async signInOAuth(provider, next = "/") {
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
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
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    return data ? mapProfile(data as ProfileRow) : null;
  },

  async getProfileByUsername(username) {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", username)
      .maybeSingle();
    return data ? mapProfile(data as ProfileRow) : null;
  },

  async updateProfile(id, patch) {
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
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapProfile(data as ProfileRow);
  },

  async getFeed(kind, viewerId) {
    const supabase = createClient();
    let query = supabase.from("posts").select("*").order("created_at", { ascending: false });

    if (kind === "following") {
      if (!viewerId) return [];
      const { data: follows } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewerId);
      const ids = (follows ?? []).map((f) => f.followee_id);
      if (ids.length === 0) return [];
      query = query.in("author_id", ids);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const posts = ((data ?? []) as PostRow[]).map(mapPost);
    const views = await hydratePosts(supabase, posts, viewerId);
    return kind === "foryou" ? views.sort((a, b) => score(b) - score(a)) : views;
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
    const { data, error } = await supabase
      .from("posts")
      .insert({
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
      })
      .select("*")
      .single();
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
    if (error) throw new Error(error.message);
    return hydratePosts(supabase, ((data ?? []) as PostRow[]).map(mapPost), viewerId);
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
      users: ((usersRes.data ?? []) as ProfileRow[]).map(mapProfile),
      posts,
    };
  },

  async trending(viewerId) {
    const views = await this.getFeed("foryou", viewerId);
    return views.sort((a, b) => score(b) - score(a));
  },

  async newFinds(viewerId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return hydratePosts(supabase, ((data ?? []) as PostRow[]).map(mapPost), viewerId);
  },

  async byCategory(category: CategoryId, viewerId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return hydratePosts(supabase, ((data ?? []) as PostRow[]).map(mapPost), viewerId);
  },

  async getFollowCounts(userId) {
    const supabase = createClient();
    const [followers, following] = await Promise.all([
      supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
      supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    return {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
    };
  },
};

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
