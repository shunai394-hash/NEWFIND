import type { Post, PostView } from "@/lib/types";

const DUMMY_HOSTS = [
  "example.com",
  "example.org",
  "example.net",
  "example.jp",
  "test.com",
  "placeholder.invalid",
  "nfdemo.invalid",
];

export function isDummyUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  return DUMMY_HOSTS.some(
    (host) =>
      trimmed.includes(`://${host}`) ||
      trimmed.includes(`.${host}`) ||
      trimmed.startsWith(host),
  );
}

export function isAiPersonDiscoveryMedia(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.toLowerCase();
  return (
    value.includes("gen_fashion_") ||
    value.includes("gen_beauty_") ||
    value.includes("gen_food_") ||
    value.includes("gen_lifestyle_") ||
    value.includes("gen_home_") ||
    value.includes("/gen_") ||
    value.includes("demo-jp-img/gen_") ||
    value.includes("tmp-img/gen") ||
    value.includes("gen-fashion") ||
    value.includes("generated-person") ||
    value.includes("ai-person") ||
    /[?&]v=gen\d+/i.test(value)
  );
}

export function isOverseasDemoUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  return username.startsWith("nfdemo_") && !username.startsWith("nfdemo_jp_");
}

export function hasDisplayablePostMedia(
  post: Pick<Post, "mediaUrl" | "thumbnailUrl" | "mediaType">,
): boolean {
  const media = (post.mediaUrl || "").trim();
  const thumb = (post.thumbnailUrl || "").trim();
  if (!media) return false;
  if (isAiPersonDiscoveryMedia(media) || isAiPersonDiscoveryMedia(thumb)) return false;
  return true;
}

export function isProductDiscoverySafePost(
  post: Pick<Post, "mediaUrl" | "thumbnailUrl" | "visualKind" | "productUrl" | "sourceUrl" | "mediaType"> & {
    author?: { username?: string } | null;
  },
): boolean {
  if (!hasDisplayablePostMedia(post)) return false;
  if (isDummyUrl(post.productUrl) || isDummyUrl(post.sourceUrl)) return false;
  if (isOverseasDemoUsername(post.author?.username)) return false;
  return true;
}

export function filterDiscoveryPosts<T extends PostView>(posts: T[]): T[] {
  return posts.filter((post) => isProductDiscoverySafePost(post));
}
