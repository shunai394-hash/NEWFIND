import { createAdminClient } from "@/lib/supabase/admin";

function s(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function publishBrandBridgeToFeed(input: {
  eventId: string;
  payload: Record<string, unknown>;
}) {
  const productUrl = s(input.payload.product_url);
  const productName = s(input.payload.product_name) || s(input.payload.title);
  const brand = s(input.payload.brand);
  const category = s(input.payload.category) || "other";
  const imageUrl = s(input.payload.image_url) || s(input.payload.product_image_url);

  if (!productUrl || !productName || !imageUrl) {
    throw new Error("brandbridge_product requires product_url, product_name and image_url");
  }

  const admin = createAdminClient();
  const productId = `brandbridge:${s(input.payload.source_id) || input.eventId}`;
  const now = new Date().toISOString();
  const description =
    s(input.payload.description) ||
    s(input.payload.note) ||
    s(input.payload.discovery_reason) ||
    "";

  const { error: productError } = await admin.from("products").upsert({
    id: productId,
    name: productName,
    brand: brand || "BrandBridge",
    collections: [category],
    subcategory: category,
    subcategory_label: category,
    description,
    image_url: imageUrl,
    source_url: productUrl,
    source_title: productName,
    source_kind: "brandbridge",
    purchase_url: productUrl,
    purchase_label: "BrandBridgeで見る",
    seller: brand,
    tags: ["brandbridge", "product-discovery"],
    published_at: now.slice(0, 10),
    updated_at: now,
  }, { onConflict: "id" });

  if (productError) throw new Error(`product upsert failed: ${productError.message}`);

  const { data: personas, error: personaError } = await admin
    .from("ai_personas")
    .select("id, persona_name, preferred_categories, favorite_brands")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(50);

  if (personaError) throw new Error(`persona lookup failed: ${personaError.message}`);

  const persona =
    (personas ?? []).find((p) =>
      Array.isArray(p.preferred_categories) &&
      p.preferred_categories.some((v: unknown) => String(v).toLowerCase() === category.toLowerCase())
    ) ||
    (personas ?? []).find((p) =>
      brand &&
      Array.isArray(p.favorite_brands) &&
      p.favorite_brands.some((v: unknown) => String(v).toLowerCase() === brand.toLowerCase())
    ) ||
    personas?.[0];

  if (!persona) return { productId, aiPostId: null, detail: "product stored; no active AI persona" };

  const { data: existing, error: existingError } = await admin
    .from("ai_posts")
    .select("id")
    .eq("product_url", productUrl)
    .eq("persona_id", persona.id)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`AI post lookup failed: ${existingError.message}`);
  if (existing?.id) return { productId, aiPostId: String(existing.id), detail: "AI post already exists" };

  const caption = [
    brand ? `[${brand}]` : null,
    productName,
    description ? description.slice(0, 220) : "NEWFINDで見つけた注目の商品。",
    "BrandBridgeからNEWFINDへ。",
  ].filter(Boolean).join("\n\n");

  const { data: post, error: postError } = await admin.from("ai_posts").insert({
    persona_id: persona.id,
    media_type: "photo",
    media_url: imageUrl,
    thumbnail_url: imageUrl,
    caption,
    category,
    product_url: productUrl,
    product_label: "BrandBridgeで見る",
    status: "published",
    published_at: now,
  }).select("id").single();

  if (postError) throw new Error(`AI post insert failed: ${postError.message}`);
  return { productId, aiPostId: String(post.id), detail: `published via ${persona.persona_name}` };
}
