import type {
  CommentView,
  CreatePostInput,
  FollowCounts,
  PostView,
  Profile,
  SearchResult,
  Session,
  UpdateProfileInput,
} from "@/lib/types";
import type { CategoryId } from "@/lib/types";

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
  getFeed(kind: "foryou" | "following", viewerId: string | null): Promise<PostView[]>;
  getPost(id: string, viewerId: string | null): Promise<PostView | null>;
  createPost(authorId: string, input: CreatePostInput): Promise<PostView>;
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
  getUserPosts(userId: string, viewerId: string | null): Promise<PostView[]>;
  search(query: string, viewerId: string | null): Promise<SearchResult>;
  trending(viewerId: string | null): Promise<PostView[]>;
  newFinds(viewerId: string | null): Promise<PostView[]>;
  byCategory(category: CategoryId, viewerId: string | null): Promise<PostView[]>;
  getFollowCounts(userId: string): Promise<FollowCounts>;
};
