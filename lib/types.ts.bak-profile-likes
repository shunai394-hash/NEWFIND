export type AccountType = "personal" | "business";
export type MediaType = "photo" | "video";
export type PostSource = "user" | "brandbridge";

export const CATEGORIES = [
  "fashion",
  "beauty",
  "food",
  "home",
  "tech",
  "sports",
  "lifestyle",
  "travel",
  "other",
  "accessories",
  "fragrance",
  "japan_brands",
  "celebrity",
  "anime_culture",
] as const;

export type CategoryId = (typeof CATEGORIES)[number];

export const VISUAL_KINDS = [
  "model",
  "product",
  "street",
  "lifestyle",
  "illustration",
  "anime",
  "brand",
] as const;

export type VisualKind = (typeof VISUAL_KINDS)[number];

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  accountType: AccountType;
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  websiteUrl: string | null;
  isAdmin?: boolean;
  isSuspended?: boolean;
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: CategoryId;
  productUrl: string | null;
  productLabel: string | null;
  isSponsored: boolean;
  source: PostSource;
  sourceRef: string | null;
  sourceUrl: string | null;
  japanContext?: string | null;
  visualKind?: VisualKind | null;
  featuredPerson?: string | null;
  featuredCredit?: string | null;
  discoveryProductId?: string | null;
  createdAt: string;
};

export type Comment = {
  id: string;
  userId: string;
  postId: string;
  body: string;
  createdAt: string;
};

export type Session = {
  userId: string;
  email: string;
};

export type PostView = Post & {
  author: Profile;
  likeCount: number;
  wantCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  liked: boolean;
  wanted: boolean;
  saved: boolean;
  followingAuthor: boolean;
};

export type CommentView = Comment & {
  author: Profile;
};

export type FollowCounts = {
  followers: number;
  following: number;
};

export type FollowListEntry = {
  profile: Profile;
  following: boolean;
};

export type SearchResult = {
  users: Profile[];
  posts: PostView[];
};

export type CreatePostInput = {
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  category: CategoryId;
  productUrl?: string | null;
  productLabel?: string | null;
  isSponsored?: boolean;
  source?: PostSource;
  sourceRef?: string | null;
  sourceUrl?: string | null;
  japanContext?: string | null;
  visualKind?: VisualKind | null;
  featuredPerson?: string | null;
  featuredCredit?: string | null;
  discoveryProductId?: string | null;
};

export type UpdatePostInput = {
  caption?: string;
  category?: CategoryId;
  productUrl?: string | null;
  productLabel?: string | null;
  visualKind?: VisualKind | null;
  mediaUrl?: string;
  mediaType?: MediaType;
  thumbnailUrl?: string | null;
};

export type UpdateProfileInput = {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  accountType?: AccountType;
  companyName?: string | null;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  websiteUrl?: string | null;
};

