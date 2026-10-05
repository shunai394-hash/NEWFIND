/**
 * Regression tests for the craft-bottle repetition fix: one shared decorative
 * craft classifier (English and Japanese) used by the product hunter, the
 * posting gate and the homepage, without blocking real handmade products.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isDecorativeCraftObject } from "../lib/ai/craft-object";
import { isRejectedProductType } from "../lib/ai/product-hunter";
import {
  dropCommunityRepeatedSubjects,
  subjectVisualArchetypes,
  type CommunityPostContext,
  type PostSubject,
} from "../lib/ai/resident-life";
import { isHomepageProductEligible } from "../lib/world/home-data";

const DECORATIVE = [
  "Craft bottle",
  "Handcrafted glass bottle",
  "Hand-blown glass vase",
  "Artisanal glass bottles",
  "Decorative glass bottle",
  "Ceramic vessel",
  "Pottery bowl set",
  "Resin art coaster",
  "クラフトボトル",
  "手吹きガラスの花瓶",
  "ハンドメイドのガラス瓶",
  "作家の器",
  "装飾ボトル",
  "アートオブジェ",
  "陶芸作品",
];

const USEFUL = [
  "Minimalist travel bottle",
  "Insulated water bottle",
  "Handcrafted leather wallet",
  "Italian craftsmanship leather jacket",
  "Japanese chisel set",
  "Merino yarn",
  "Craft beer IPA",
  "Aircraft-grade aluminium case",
  "Glass storage container",
  "クラフトビール",
  "手作り器具セット",
  "クラフト瓶詰めジャム",
  "陶器のマグカップ",
];

test("decorative craft objects are detected in English and Japanese", () => {
  for (const text of DECORATIVE) {
    assert.equal(isDecorativeCraftObject(text), true, text);
  }
});

test("useful and handmade products are not treated as decorative craft", () => {
  for (const text of USEFUL) {
    assert.equal(isDecorativeCraftObject(text), false, text);
  }
  assert.equal(isDecorativeCraftObject(""), false);
  assert.equal(isDecorativeCraftObject(null), false);
});

test("product hunter rejects Japanese craft bottles it used to accept", () => {
  assert.equal(isRejectedProductType("クラフトボトル 限定カラー"), true);
  assert.equal(isRejectedProductType("Handmade glass bottle"), true);
  assert.equal(isRejectedProductType("Insulated water bottle 500ml"), false);
});

const verifiedProduct = {
  brand: "Studio Nami",
  name: "Everyday tote",
  imageUrl: "https://cdn.example.com/products/tote.jpg",
  price: 12000,
  description: "Canvas tote bag",
};

test("homepage drops Japanese-named craft bottles but keeps useful products", () => {
  assert.equal(isHomepageProductEligible(verifiedProduct), true);
  assert.equal(
    isHomepageProductEligible({ ...verifiedProduct, name: "手吹きガラスのクラフトボトル" }),
    false,
  );
  assert.equal(
    isHomepageProductEligible({ ...verifiedProduct, description: "作家の器シリーズ" }),
    false,
  );
  assert.equal(
    isHomepageProductEligible({ ...verifiedProduct, name: "陶器のマグカップ" }),
    true,
  );
});

test("Japanese captions are counted toward community theme caps", () => {
  const themes = subjectVisualArchetypes({ label: "手作りのガラスボトルを見つけました" });
  assert.ok(themes.includes("craft_object"));
  assert.ok(themes.includes("bottle"));
  assert.deepEqual(
    subjectVisualArchetypes({ label: "クラフトビールの新作" }).includes("craft_object"),
    false,
  );
  // Each theme is counted once per caption even when both languages match.
  const mixed = subjectVisualArchetypes({ label: "handmade 手作り bottle ボトル" });
  assert.equal(mixed.length, new Set(mixed).size);
});

function community(overrides: Partial<CommunityPostContext> = {}): CommunityPostContext {
  return {
    keys: new Set(),
    domainCounts: new Map(),
    captions: [],
    visualArchetypes: new Map(),
    ...overrides,
  };
}

function subject(overrides: Partial<PostSubject>): PostSubject {
  return { id: "s", kind: "hunter", label: "Product", ...overrides };
}

test("posting gate always drops decorative craft objects, even when assigned", () => {
  const kept = dropCommunityRepeatedSubjects(
    [
      subject({ id: "ja", label: "クラフトボトル", assigned: true }),
      subject({ id: "en", label: "Handmade glass bottle" }),
    ],
    community(),
  );
  assert.deepEqual(kept, []);
});

test("posting gate keeps craft tools and craftsmanship products until the theme repeats", () => {
  const tools = subject({ id: "tools", label: "Japanese chisel set", category: "craft" });
  const jacket = subject({ id: "jacket", label: "Leather jacket with Italian craftsmanship" });
  assert.deepEqual(
    dropCommunityRepeatedSubjects([tools, jacket], community()).map((s) => s.id),
    ["tools", "jacket"],
  );
  const saturated = community({ visualArchetypes: new Map([["craft_object", 2]]) });
  assert.deepEqual(dropCommunityRepeatedSubjects([tools, jacket], saturated), []);
});

test("posting gate treats tracking-parameter variants of a posted URL as repeats", () => {
  const posted = community({
    keys: new Set(["url:https://shop.example.com/products/tote"]),
  });
  const kept = dropCommunityRepeatedSubjects(
    [
      subject({ id: "dup", productUrl: "https://www.shop.example.com/products/tote/?utm_source=x" }),
      subject({ id: "new", productUrl: "https://shop.example.com/products/cap" }),
    ],
    posted,
  );
  assert.deepEqual(kept.map((s) => s.id), ["new"]);
});
