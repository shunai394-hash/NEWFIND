import { isHomepageProductEligible } from "../lib/world/home-data";

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
