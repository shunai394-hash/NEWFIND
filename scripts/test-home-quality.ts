import { hasVerifiedProductIdentity, isHomepageProductConfidenceEligible, isHomepageProductEligible, normalizeHomepageProductPrice } from "../lib/world/home-data";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  const verified = {
    brand: "Acme",
    name: "New fragrance",
    imageUrl: "https://example.com/product.jpg",
    price: 32,
    description: "A new fragrance product.",
  };

  assert(isHomepageProductEligible(verified), "verified product should pass");
  assert(
    normalizeHomepageProductPrice(1299) === 1299,
    "numeric product prices should be preserved",
  );
  assert(
    normalizeHomepageProductPrice("1,299.50") === 1299.5,
    "numeric database prices serialized as strings should be normalized",
  );
  assert(
    normalizeHomepageProductPrice("unknown") === null,
    "non-numeric product prices must be rejected",
  );
  assert(
    normalizeHomepageProductPrice(0) === null &&
      normalizeHomepageProductPrice(-5) === null,
    "zero and negative product prices must be rejected",
  );
  assert(
    hasVerifiedProductIdentity({ productUrl: "https://brand.example/products/item" }),
    "canonical product URL should count as source identity evidence",
  );
  assert(
    hasVerifiedProductIdentity({ officialUrl: "https://brand.example/item" }),
    "official URL should count as source identity evidence",
  );
  assert(
    hasVerifiedProductIdentity({ sku: "SKU-100" }),
    "structured SKU should count as identity evidence",
  );
  assert(
    !hasVerifiedProductIdentity({ productUrl: "http://brand.example/item" }),
    "insecure source URL alone must not count as identity evidence",
  );
  assert(
    !hasVerifiedProductIdentity({}),
    "missing source and structured identity must fail",
  );
  assert(
    isHomepageProductConfidenceEligible(72, true),
    "strong confidence with identity should pass",
  );
  assert(
    !isHomepageProductConfidenceEligible(42, true),
    "low confidence should fail even with identity",
  );
  assert(
    isHomepageProductConfidenceEligible(null, true),
    "legacy approved product with verifiable identity should not be hidden only because its confidence score is absent",
  );
  assert(
    !isHomepageProductConfidenceEligible(null, false),
    "missing confidence and identity must fail",
  );
  assert(
    isHomepageProductConfidenceEligible("61", true),
    "numeric confidence values returned as strings should be handled",
  );
  assert(
    !isHomepageProductEligible(
      { brand: "Discovery", name: "Discovery", imageUrl: "https://example.com/product.jpg" },
      { requireVerifiedFields: false },
    ),
    "fallback must not render placeholder discovery labels as products",
  );
  assert(
    !isHomepageProductEligible({ ...verified, brand: "" }),
    "anonymous product must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, brand: "Unknown" }),
    "unknown brand must fail the homepage quality gate",
  );
  assert(
    !isHomepageProductEligible(
      { ...verified, brand: "Discovery" },
      { requireVerifiedFields: false },
    ),
    "placeholder brand must fail even when optional verification fields are relaxed",
  );
  assert(
    !isHomepageProductEligible({ ...verified, imageUrl: null }),
    "product without image must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, imageUrl: "not-a-url" }),
    "invalid image URL must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, imageUrl: "http://example.com/product.jpg" }),
    "insecure image URL must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, imageUrl: "https://example.com/placeholder-product.jpg" }),
    "placeholder image must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, price: 0 }),
    "zero-price placeholder must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, price: -12 }),
    "negative price must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, price: null }),
    "unpriced product must fail",
  );
  assert(
    isHomepageProductEligible(
      { ...verified, price: null },
      { requireVerifiedFields: false },
    ),
    "a discovery chip with no displayed price may pass when its identity and image are verified",
  );
  assert(
    !isHomepageProductEligible({
      ...verified,
      name: "Ceramic Tea Whisk Vertical Tea Whisk Seats",
    }),
    "repeated craft-object product must fail",
  );
  assert(
    !isHomepageProductEligible({
      ...verified,
      name: "Handcrafted decorative object",
    }),
    "craft/decorative object must fail",
  );

  for (const name of [
    "Craft bottle",
    "Handcrafted glass bottle",
    "Decorative bottle",
    "Artisanal glass bottles",
    "Craft vessels",
  ]) {
    assert(
      !isHomepageProductEligible({ ...verified, name }),
      `repetitive craft/vessel product must fail: ${name}`,
    );
  }

  assert(
    isHomepageProductEligible({ ...verified, name: "Minimalist travel bottle" }),
    "legitimate functional bottle must remain eligible",
  );

  assert(
    isHomepageProductEligible({ ...verified, name: "Handcrafted leather wallet" }),
    "handcrafted functional product must not be rejected just for being handcrafted",
  );

  console.log("Homepage quality gate tests passed");
}

main();
