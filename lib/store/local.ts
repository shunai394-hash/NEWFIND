import { fileToStoredUrl } from "@/lib/media";
import { rankForYouFeed, engagementScore } from "@/lib/feed-rank";
import { filterDiscoveryPosts } from "@/lib/products/discovery-filter";
import {
  SEED_COMMENTS,
  SEED_FOLLOWS,
  SEED_LIKES,
  SEED_POSTS,
  SEED_PROFILES,
  SEED_SAVES,
  SEED_WANTS,
} from "@/lib/seed";
import {
  SEED_JP_COMMENTS,
  SEED_JP_FOLLOWS,
  SEED_JP_LIKES,
  SEED_JP_POSTS,
  SEED_JP_PROFILES,
  SEED_JP_REACTORS,
  SEED_JP_SAVES,
  SEED_JP_WANTS,
} from "@/lib/seed-jp";
import type { Store } from "@/lib/store/types";
import type {
  CategoryId,
  Comment,
  CommentView,
  CreatePostInput,
  FollowListEntry,
  Post,
  PostView,
  Profile,
  Session,
  UpdateProfileInput,
} from "@/lib/types";

const KEY = "newfind.local.v4";

type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
};

type LocalState = {
  users: LocalUser[];
  session: Session | null;
  profiles: Profile[];
  posts: Post[];
  follows: Array<{ followerId: string; followeeId: string }>;
  likes: Array<{ userId: string; postId: string }>;
  wants: Array<{ userId: string; postId: string }>;
  saves: Array<{ userId: string; postId: string }>;
  comments: Comment[];
  shares: Array<{ id: string; userId: string | null; postId: string }>;
};

function emptyState(): LocalState {
  return {
    users: [],
    session: null,
    profiles: structuredClone([...SEED_PROFILES, ...SEED_JP_PROFILES]),
    posts: structuredClone([...SEED_POSTS, ...SEED_JP_POSTS]),
    follows: structuredClone([...SEED_FOLLOWS, ...SEED_JP_FOLLOWS]),
    likes: structuredClone([...SEED_LIKES, ...SEED_JP_LIKES]),
    wants: structuredClone([...SEED_WANTS, ...SEED_JP_WANTS]),
    saves: structuredClone([...SEED_SAVES, ...SEED_JP_SAVES]),
    comments: structuredClone([...SEED_COMMENTS, ...SEED_JP_COMMENTS]),
    shares: [],
  };
}

function load(): LocalState {
  if (typeof window === "undefined") return emptyState();
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    const seeded = emptyState();
    save(seeded);
    return seeded;
  }
  try {
    const parsed = { ...emptyState(), ...JSON.parse(raw) } as LocalState;
    parsed.profiles = (parsed.profiles ?? []).map(normalizeProfile);
    return parsed;
  } catch {
    const seeded = emptyState();
    save(seeded);
    return seeded;
  }
}

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    instagramUrl: profile.instagramUrl ?? null,
    xUrl: profile.xUrl ?? null,
    tiktokUrl: profile.tiktokUrl ?? null,
    youtubeUrl: profile.youtubeUrl ?? null,
    websiteUrl: profile.websiteUrl ?? null,
  };
}

function save(state: LocalState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

function mutate<T>(fn: (state: LocalState) => T): T {
  const state = load();
  const result = fn(state);
  save(state);
  return result;
}

function newId() {
  return crypto.randomUUID();
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function usernameFromEmail(email: string, taken: Set<string>) {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 16) || "user";
  let name = base;
  let i = 1;
  while (taken.has(name)) {
    name = `${base}${i}`;
    i += 1;
  }
  return name;
}

function toView(state: LocalState, post: Post, viewerId: string | null): PostView {
  const author = state.profiles.find((p) => p.id === post.authorId);
  if (!author) {
    throw new Error("投稿者のプロフィールが見つかりません");
  }
  return {
    ...post,
    author,
    likeCount: state.likes.filter((x) => x.postId === post.id).length,
    wantCount: state.wants.filter((x) => x.postId === post.id).length,
    commentCount: state.comments.filter((x) => x.postId === post.id).length,
    saveCount: state.saves.filter((x) => x.postId === post.id).length,
    shareCount: state.shares.filter((x) => x.postId === post.id).length,
    liked: viewerId ? state.likes.some((x) => x.postId === post.id && x.userId === viewerId) : false,
    wanted: viewerId ? state.wants.some((x) => x.postId === post.id && x.userId === viewerId) : false,
    saved: viewerId ? state.saves.some((x) => x.postId === post.id && x.userId === viewerId) : false,
    followingAuthor: viewerId
      ? state.follows.some((x) => x.followerId === viewerId && x.followeeId === post.authorId)
      : false,
  };
}

function score(view: PostView) {
  return engagementScore(view);
}

export const localStore: Store = {
  async getSession() {
    return load().session;
  },

  async signInEmail(email, password) {
    const state = load();
    const hash = await hashPassword(password);
    const user = state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash,
    );
    if (!user) throw new Error("メールアドレスまたはパスワードが違います");
    state.session = { userId: user.id, email: user.email };
    save(state);
    return state.session;
  },

  async signUpEmail(email, password, displayName) {
    const hash = await hashPassword(password);
    return mutate((state) => {
      if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("このメールアドレスはすでに使われています");
      }
      const id = newId();
      const username = usernameFromEmail(
        email,
        new Set(state.profiles.map((p) => p.username.toLowerCase())),
      );
      state.users.push({ id, email, passwordHash: hash });
      state.profiles.push({
        id,
        username,
        displayName: displayName.trim() || username,
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
        createdAt: new Date().toISOString(),
      });
      state.session = { userId: id, email };
      return state.session;
    });
  },

  async signInOAuth(_provider, _next) {
    throw new Error(
      "Google / Apple ログインは Supabase Auth の設定後に利用できます",
    );
  },

  async signOut() {
    mutate((state) => {
      state.session = null;
    });
  },

  async getProfile(id) {
    return load().profiles.find((p) => p.id === id) ?? null;
  },

  async ensureMyProfile(session) {
    const existing = load().profiles.find((p) => p.id === session.userId);
    if (existing) return existing;
    return mutate((state) => {
      const username = usernameFromEmail(
        session.email,
        new Set(state.profiles.map((p) => p.username.toLowerCase())),
      );
      const profile: Profile = {
        id: session.userId,
        username,
        displayName: username,
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
        createdAt: new Date().toISOString(),
      };
      state.profiles.push(profile);
      return { ...profile };
    });
  },

  async getProfileByUsername(username) {
    return (
      load().profiles.find(
        (p) => p.username.toLowerCase() === username.toLowerCase(),
      ) ?? null
    );
  },

  async updateProfile(id, patch: UpdateProfileInput) {
    return mutate((state) => {
      const profile = state.profiles.find((p) => p.id === id);
      if (!profile) throw new Error("プロフィールが見つかりません");
      if (patch.username && patch.username !== profile.username) {
        const taken = state.profiles.some(
          (p) =>
            p.id !== id &&
            p.username.toLowerCase() === patch.username!.toLowerCase(),
        );
        if (taken) throw new Error("このユーザー名は使われています");
      }
      Object.assign(profile, {
        username: patch.username ?? profile.username,
        displayName: patch.displayName ?? profile.displayName,
        bio: patch.bio ?? profile.bio,
        avatarUrl: patch.avatarUrl === undefined ? profile.avatarUrl : patch.avatarUrl,
        accountType: patch.accountType ?? profile.accountType,
        companyName:
          patch.companyName === undefined ? profile.companyName : patch.companyName,
        companyWebsite:
          patch.companyWebsite === undefined
            ? profile.companyWebsite
            : patch.companyWebsite,
        companyDescription:
          patch.companyDescription === undefined
            ? profile.companyDescription
            : patch.companyDescription,
        instagramUrl:
          patch.instagramUrl === undefined ? profile.instagramUrl : patch.instagramUrl,
        xUrl: patch.xUrl === undefined ? profile.xUrl : patch.xUrl,
        tiktokUrl:
          patch.tiktokUrl === undefined ? profile.tiktokUrl : patch.tiktokUrl,
        youtubeUrl:
          patch.youtubeUrl === undefined ? profile.youtubeUrl : patch.youtubeUrl,
        websiteUrl:
          patch.websiteUrl === undefined ? profile.websiteUrl : patch.websiteUrl,
      });
      return { ...profile };
    });
  },

  async getFeed(kind, viewerId, offset = 0, limit = 24) {
    const state = load();
    let posts = [...state.posts];
    if (kind === "following") {
      if (!viewerId) {
        return { posts: [], hasMore: false, nextOffset: 0 };
      }
      const followees = new Set(
        state.follows.filter((f) => f.followerId === viewerId).map((f) => f.followeeId),
      );
      posts = posts.filter((p) => followees.has(p.authorId));
    }
    posts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (kind === "foryou") {
      const slice = posts.slice(offset, offset + limit);
      const ranked = rankForYouFeed(
        filterDiscoveryPosts(slice.map((p) => toView(state, p, viewerId))),
      );
      return {
        posts: ranked,
        hasMore: slice.length === limit,
        nextOffset: offset + slice.length,
      };
    }
    const slice = posts.slice(offset, offset + limit);
    const views = slice.map((p) => toView(state, p, viewerId));
    return {
      posts: views,
      hasMore: slice.length === limit,
      nextOffset: offset + slice.length,
    };
  },

  async getPost(id, viewerId) {
    const state = load();
    const post = state.posts.find((p) => p.id === id);
    return post ? toView(state, post, viewerId) : null;
  },

  async createPost(authorId, input: CreatePostInput) {
    return mutate((state) => {
      const post: Post = {
        id: newId(),
        authorId,
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        caption: input.caption,
        category: input.category,
        productUrl: input.productUrl || null,
        productLabel: input.productLabel || null,
        isSponsored: Boolean(input.isSponsored),
        source: input.source ?? "user",
        sourceRef: input.sourceRef || null,
        sourceUrl: input.sourceUrl || null,
        japanContext: input.japanContext ?? null,
        visualKind: input.visualKind ?? null,
        featuredPerson: input.featuredPerson ?? null,
        featuredCredit: input.featuredCredit ?? null,
        discoveryProductId: input.discoveryProductId ?? null,
        createdAt: new Date().toISOString(),
      };
      state.posts.unshift(post);
      return toView(state, post, authorId);
    });
  },

  async uploadMedia(file) {
    return fileToStoredUrl(file);
  },

  async toggleLike(postId, userId) {
    return mutate((state) => togglePair(state.likes, postId, userId));
  },

  async toggleWant(postId, userId) {
    return mutate((state) => togglePair(state.wants, postId, userId));
  },

  async toggleSave(postId, userId) {
    return mutate((state) => togglePair(state.saves, postId, userId));
  },

  async sharePost(postId, userId) {
    mutate((state) => {
      state.shares.push({ id: newId(), userId, postId });
    });
  },

  async addComment(postId, userId, body) {
    return mutate((state) => {
      const comment: Comment = {
        id: newId(),
        userId,
        postId,
        body: body.trim(),
        createdAt: new Date().toISOString(),
      };
      state.comments.push(comment);
      const author = state.profiles.find((p) => p.id === userId);
      if (!author) throw new Error("プロフィールが見つかりません");
      return { ...comment, author };
    });
  },

  async listComments(postId) {
    const state = load();
    return state.comments
      .filter((c) => c.postId === postId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .flatMap((c) => {
        const author = state.profiles.find((p) => p.id === c.userId);
        return author ? [{ ...c, author }] : [];
      });
  },

  async isFollowing(followerId, followeeId) {
    return load().follows.some(
      (f) => f.followerId === followerId && f.followeeId === followeeId,
    );
  },

  async toggleFollow(followeeId, followerId) {
    if (followeeId === followerId) throw new Error("自分はフォローできません");
    return mutate((state) => {
      const index = state.follows.findIndex(
        (f) => f.followerId === followerId && f.followeeId === followeeId,
      );
      if (index >= 0) {
        state.follows.splice(index, 1);
        return false;
      }
      state.follows.push({ followerId, followeeId });
      return true;
    });
  },

  async getSaved(userId) {
    const state = load();
    return state.saves
      .filter((s) => s.userId === userId)
      .map((s) => state.posts.find((p) => p.id === s.postId))
      .filter((p): p is Post => Boolean(p))
      .map((p) => toView(state, p, userId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async getUserPosts(userId, viewerId) {
    const state = load();
    return state.posts
      .filter((p) => p.authorId === userId)
      .map((p) => toView(state, p, viewerId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async search(query, viewerId) {
    const q = query.trim().toLowerCase();
    const state = load();
    if (!q) return { users: [], posts: [] };
    const users = state.profiles.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        (p.companyName ?? "").toLowerCase().includes(q),
    );
    const posts = state.posts
      .filter(
        (p) =>
          p.caption.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .map((p) => toView(state, p, viewerId));
    return { users, posts: filterDiscoveryPosts(posts) };
  },

  async trending(viewerId, offset = 0, limit = 24) {
    return this.getFeed("foryou", viewerId, offset, limit);
  },

  async newFinds(viewerId, offset = 0, limit = 24) {
    const state = load();
    const sorted = [...state.posts].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const slice = sorted.slice(offset, offset + limit);
    const posts = filterDiscoveryPosts(slice.map((p) => toView(state, p, viewerId)));
    return {
      posts,
      hasMore: slice.length === limit,
      nextOffset: offset + slice.length,
    };
  },

  async byCategory(category: CategoryId, viewerId, offset = 0, limit = 24) {
    const state = load();
    const filtered = state.posts
      .filter((p) => p.category === category)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const slice = filtered.slice(offset, offset + limit);
    const posts = filterDiscoveryPosts(slice.map((p) => toView(state, p, viewerId)));
    return {
      posts,
      hasMore: slice.length === limit,
      nextOffset: offset + slice.length,
    };
  },

  async getFollowCounts(userId) {
    const state = load();
    return {
      followers: state.follows.filter((f) => f.followeeId === userId).length,
      following: state.follows.filter((f) => f.followerId === userId).length,
    };
  },

  async listFollowers(userId, viewerId) {
    const state = load();
    const ids = state.follows
      .filter((f) => f.followeeId === userId)
      .map((f) => f.followerId);
    return toFollowList(state, ids, viewerId);
  },

  async listFollowing(userId, viewerId) {
    const state = load();
    const ids = state.follows
      .filter((f) => f.followerId === userId)
      .map((f) => f.followeeId);
    return toFollowList(state, ids, viewerId);
  },
};

const JP_REACTOR_BY_ID = new Map(SEED_JP_REACTORS.map((p) => [p.id, p]));

function resolveLocalProfile(state: LocalState, id: string): Profile | null {
  return (
    state.profiles.find((p) => p.id === id) ??
    JP_REACTOR_BY_ID.get(id) ??
    null
  );
}

function toFollowList(
  state: LocalState,
  ids: string[],
  viewerId: string | null,
): FollowListEntry[] {
  const entries: FollowListEntry[] = [];
  for (const id of ids) {
    const profile = resolveLocalProfile(state, id);
    if (!profile) continue;
    entries.push({
      profile,
      following: viewerId
        ? state.follows.some((f) => f.followerId === viewerId && f.followeeId === id)
        : false,
    });
  }
  return entries.sort((a, b) =>
    a.profile.displayName.localeCompare(b.profile.displayName, "ja"),
  );
}

function togglePair(
  rows: Array<{ userId: string; postId: string }>,
  postId: string,
  userId: string,
) {
  const index = rows.findIndex((r) => r.postId === postId && r.userId === userId);
  if (index >= 0) {
    rows.splice(index, 1);
    return false;
  }
  rows.push({ userId, postId });
  return true;
}
