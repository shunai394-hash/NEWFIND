import type {
  CommentView,
  CreatePostInput,
  FollowCounts,
  FollowListEntry,
  PostView,
  Profile,
  SearchResult,
  Session,
  UpdatePostInput,
  UpdateProfileInput,
} from "@/lib/types";
import type { CategoryId } from "@/lib/types";

export type FeedPage = {
  posts: PostView[];
  hasMore: boolean;
  nextOffset: number;
};

export type Store = {
  getSession(): Promise<Session | null>;
  signInEmail(email: string, password: string): Promise<Session>;
  signUpEmail(
    email: string,
    password: string,
    displayName: string,
  ): Promise<Session>;
  signInOAuth(provider: "google" | "apple", next?: string): Promise<void>;
  signOut(): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  getProfileByUsername(username: string): Promise<Profile | null>;
  ensureMyProfile(session: Session): Promise<Profile>;
  updateProfile(id: string, patch: UpdateProfileInput): Promise<Profile>;
  getFeed(
    kind: "foryou" | "following",
    viewerId: string | null,
    offset?: number,
    limit?: number,
  ): Promise<FeedPage>;
  getPost(id: string, viewerId: string | null): Promise<PostView | null>;
  createPost(authorId: string, input: CreatePostInput): Promise<PostView>;
  updatePost(postId: string, userId: string, patch: UpdatePostInput): Promise<PostView>;
  uploadMedia(file: File): Promise<{ url: string; type: "photo" | "video" }>;
  toggleLike(postId: string, userId: string): Promise<boolean>;
  toggleWant(postId: string, userId: string): Promise<boolean>;
  toggleSave(postId: string, userId: string): Promise<boolean>;
  sharePost(postId: string, userId: string | null): Promise<void>;
  addComment(postId: string, userId: string, body: string): Promise<CommentView>;
  listComments(postId: string): Promise<CommentView[]>;
  toggleFollow(followeeId: string, followerId: string): Promise<boolean>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  getSaved(userId: string): Promise<PostView[]>;
  getLiked(userId: string): Promise<PostView[]>;
  getUserPosts(userId: string, viewerId: string | null): Promise<PostView[]>;
  deletePost(postId: string, userId: string): Promise<{ warning?: string | null }>;
  deleteAccount(): Promise<{ warning?: string | null }>;
  search(query: string, viewerId: string | null): Promise<SearchResult>;
  trending(
    viewerId: string | null,
    offset?: number,
    limit?: number,
  ): Promise<FeedPage>;
  newFinds(
    viewerId: string | null,
    offset?: number,
    limit?: number,
  ): Promise<FeedPage>;
  byCategory(
    category: CategoryId,
    viewerId: string | null,
    offset?: number,
    limit?: number,
  ): Promise<FeedPage>;
  getFollowCounts(userId: string): Promise<FollowCounts>;
  listFollowers(userId: string, viewerId: string | null): Promise<FollowListEntry[]>;
  listFollowing(userId: string, viewerId: string | null): Promise<FollowListEntry[]>;
};
