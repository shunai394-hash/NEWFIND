import {
  buildCreatePostPayload,
  isVisibleTimelinePost,
  normalizePostMedia,
  requirePostCaption,
  shouldAttemptFallbackTweet,
} from "../lib/posts/text-post";
import { hasDisplayablePostMedia } from "../lib/products/discovery-filter";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  let failed = 0;

  try {
    requirePostCaption("  今日はなんか眠い。  ");
  } catch {
    failed += 1;
    console.error("FAIL: caption should be accepted");
  }

  try {
    requirePostCaption("   ");
    failed += 1;
    console.error("FAIL: empty caption should be rejected");
  } catch {
    // expected
  }

  const textOnly = buildCreatePostPayload("user-1", {
    caption: "今日はなんか眠い。",
    category: "lifestyle",
  });
  assert(textOnly.media_type === "text", "text-only media_type");
  assert(textOnly.media_url === null, "text-only media_url");
  assert(textOnly.product_url === null, "text-only product_url");
  assert(textOnly.caption === "今日はなんか眠い。", "text-only caption");

  const formDefaultState = buildCreatePostPayload("user-1", {
    caption: "いま思っていることを書いてみよう",
    category: "lifestyle",
    mediaType: "photo",
    mediaUrl: "",
  });
  assert(
    formDefaultState.media_type === "text" && formDefaultState.media_url === null,
    "create-form default photo state without file still becomes a text post",
  );

  const withUrl = buildCreatePostPayload("user-1", {
    caption: "この前見つけたカフェ、また行きたい。",
    category: "lifestyle",
    productUrl: "https://example-cafe.test/menu",
  });
  assert(withUrl.media_type === "text", "url post stays caption-first");
  assert(withUrl.media_url === null, "url post has no media");
  assert(withUrl.product_url === "https://example-cafe.test/menu", "url post keeps product_url");

  const withImage = buildCreatePostPayload("user-1", {
    caption: "見つけた。",
    category: "fashion",
    mediaType: "photo",
    mediaUrl: "https://cdn.example.test/item.jpg",
    productUrl: "https://shop.example.test/item",
    discoveryProductId: "disc-1",
  });
  assert(withImage.media_type === "photo", "image post keeps photo");
  assert(withImage.media_url === "https://cdn.example.test/item.jpg", "image post keeps media");
  assert(
    withImage.discovery_product_id === "disc-1",
    "image post keeps discovery_product_id",
  );

  const video = normalizePostMedia({
    mediaUrl: "https://cdn.example.test/clip.mp4",
    mediaType: "video",
  });
  assert(video.mediaType === "video", "video type preserved");
  assert(video.mediaUrl?.endsWith(".mp4"), "video url preserved");

  const visibleTweet = isVisibleTimelinePost({
    mediaType: "text",
    mediaUrl: null,
    thumbnailUrl: null,
    caption: "この曲ずっと聴いてる。",
  });
  assert(visibleTweet, "caption-only post is visible");

  const visiblePhoto = isVisibleTimelinePost({
    mediaType: "photo",
    mediaUrl: "https://cdn.example.test/item.jpg",
    thumbnailUrl: null,
    caption: "見つけた。",
  });
  assert(visiblePhoto, "photo post is visible");
  assert(
    hasDisplayablePostMedia({
      mediaType: "photo",
      mediaUrl: "https://cdn.example.test/item.jpg",
      thumbnailUrl: null,
    }),
    "photo post still has displayable media",
  );
  assert(
    !hasDisplayablePostMedia({
      mediaType: "text",
      mediaUrl: null,
      thumbnailUrl: null,
    }),
    "text post is not treated as media",
  );

  const dummyHidden = isVisibleTimelinePost({
    mediaType: "photo",
    mediaUrl: "https://cdn.example.test/gen_fashion_01.jpg",
    thumbnailUrl: null,
    caption: "dummy",
  });
  assert(!dummyHidden, "dummy generated media stays hidden");

  assert(
    shouldAttemptFallbackTweet({
      activityLevel: "high",
      seed: "persona-a",
      hasProductSubject: true,
    }) === false,
    "no fallback tweet when a product subject exists",
  );

  const tweetRolls = Array.from({ length: 20 }, (_, index) =>
    shouldAttemptFallbackTweet({
      activityLevel: "medium",
      seed: `persona-${index}`,
      hasProductSubject: false,
    }),
  );
  const tweetCount = tweetRolls.filter(Boolean).length;
  assert(tweetCount > 0 && tweetCount < 20, "tweet probability is mixed, not always-on");

  const aiTweet = normalizePostMedia({ mediaUrl: null });
  assert(aiTweet.mediaType === "text" && aiTweet.mediaUrl === null, "AI tweet payload");

  const aiProductMedia = normalizePostMedia({
    mediaUrl: "https://cdn.example.test/product.jpg",
    mediaType: "photo",
  });
  assert(
    aiProductMedia.mediaType === "photo" && aiProductMedia.mediaUrl,
    "AI product media payload unchanged",
  );

  if (failed) {
    throw new Error(`text post checks failed: ${failed}`);
  }

  console.log("CHECK PASSED");
  console.log("- caption-only create payload: text / null media");
  console.log("- URL post keeps product_url without requiring media");
  console.log("- image/video posts keep photo/video media");
  console.log("- timeline shows tweets, hides dummy media");
  console.log("- AI fallback tweet is probabilistic and skipped when a product exists");
}

main();
