import { fileToStoredUrl } from "@/lib/media";
import {
  SEED_COMMENTS,
  SEED_FOLLOWS,
  SEED_LIKES,
  SEED_POSTS,
  SEED_PROFILES,
  SEED_SAVES,
  SEED_WANTS,
} from "@/lib/seed";
import type { Store } from "@/lib/store/types";
import type {
  CategoryId,
  Comment,
  CommentView,
  CreatePostInput,
  Post,
  PostView,
  Profile,
  Session,
  UpdateProfileInput,
} from "@/lib/types";

const KEY = "newfind.local.v1";

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
    profiles: structuredClone(SEED_PROFILES),
    posts: structuredClone(SEED_POSTS),
    follows: structuredClone(SEED_FOLLOWS),
    likes: structuredClone(SEED_LIKES),
    wants: structuredClone(SEED_WANTS),
    saves: structuredClone(SEED_SAVES),
    comments: structuredClone(SEED_COMMENTS),
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
    return { ...emptyState(), ...JSON.parse(raw) } as LocalState;
  } catch {
    const seeded = emptyState();
    save(seeded);
    return seeded;
  }
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
  return (
    Date.parse(view.createdAt) / 60000 +
    view.likeCount * 8 +
    view.wantCount * 12 +
    view.saveCount * 6 +
    view.commentCount * 4
  );
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
      });
      return { ...profile };
    });
  },

  async getFeed(kind, viewerId) {
    const state = load();
    let posts = [...state.posts];
    if (kind === "following") {
      if (!viewerId) return [];
      const followees = new Set(
        state.follows.filter((f) => f.followerId === viewerId).map((f) => f.followeeId),
      );
      posts = posts.filter((p) => followees.has(p.authorId));
    }
    const views = posts.map((p) => toView(state, p, viewerId));
    if (kind === "foryou") {
      return views.sort((a, b) => score(b) - score(a));
    }
    return views.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
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
    return { users, posts };
  },

  async trending(viewerId) {
    const state = load();
    return state.posts
      .map((p) => toView(state, p, viewerId))
      .sort((a, b) => score(b) - score(a));
  },

  async newFinds(viewerId) {
    const state = load();
    return state.posts
      .map((p) => toView(state, p, viewerId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async byCategory(category: CategoryId, viewerId) {
    const state = load();
    return state.posts
      .filter((p) => p.category === category)
      .map((p) => toView(state, p, viewerId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async getFollowCounts(userId) {
    const state = load();
    return {
      followers: state.follows.filter((f) => f.followeeId === userId).length,
      following: state.follows.filter((f) => f.followerId === userId).length,
    };
  },
};

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
