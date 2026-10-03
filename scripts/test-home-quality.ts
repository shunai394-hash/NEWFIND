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
    !isHomepageProductEligible({ ...verified, brand: "" }),
    "anonymous product must fail",
  );
  assert(
    !isHomepageProductEligible({ ...verified, imageUrl: null }),
    "product without image must fail",
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

  console.log("Homepage quality gate tests passed");
}

main();
