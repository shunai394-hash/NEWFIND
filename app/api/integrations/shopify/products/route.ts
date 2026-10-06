import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const MAX_BODY_BYTES = 1_000_000;

type ShopifyVariant = {
  price?: string | number;
  currency_code?: string;
};

type ShopifyImage = {
  src?: string;
  url?: string;
};

type ShopifyProductWebhook = {
  id?: string | number;
  title?: string;
  body_html?: string | null;
  handle?: string;
  vendor?: string;
  product_type?: string;
  tags?: string | string[];
  status?: string;
  published_at?: string | null;
  updated_at?: string;
  variants?: ShopifyVariant[];
  image?: ShopifyImage | null;
  images?: ShopifyImage[];
};

function safeEqualShopifyHmac(expectedBase64: string, received: string): boolean {
  const supplied = Buffer.from(received, "base64");
  if (supplied.length !== 32 || supplied.toString("base64") !== received) return false;
  const expected = Buffer.from(expectedBase64, "base64");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function asTags(value: ShopifyProductWebhook["tags"]): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function safeImage(product: ShopifyProductWebhook): string | null {
  const candidate = product.image?.src ?? product.image?.url ?? product.images?.[0]?.src ?? product.images?.[0]?.url;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  const allowedShop = process.env.SHOPIFY_ALLOWED_SHOP_DOMAIN?.trim().toLowerCase();
  if (!secret || !allowedShop) {
    return Response.json({ ok: false, error: "Shopify integration is not configured" }, { status: 503 });
  }

  const shopDomain = request.headers.get("x-shopify-shop-domain")?.trim().toLowerCase() ?? "";
  const topic = request.headers.get("x-shopify-topic")?.trim().toLowerCase() ?? "";
  const signature = request.headers.get("x-shopify-hmac-sha256")?.trim() ?? "";

  if (!shopDomain || shopDomain !== allowedShop) {
    return Response.json({ ok: false, error: "Shop is not allowed" }, { status: 401 });
  }
  if (!["products/create", "products/update", "products/delete"].includes(topic)) {
    return Response.json({ ok: false, error: "Unsupported topic" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  if (!safeEqualShopifyHmac(expected, signature)) {
    return Response.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  let product: ShopifyProductWebhook;
  try {
    product = JSON.parse(rawBody) as ShopifyProductWebhook;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (product.id == null) {
    return Response.json({ ok: false, error: "Missing product id" }, { status: 400 });
  }

  const productId = String(product.id);
  const archived = topic === "products/delete" || product.status === "archived";
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const prices = variants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const published = !archived && product.status === "active" && Boolean(product.published_at);
  const handle = typeof product.handle === "string" ? product.handle.trim() : "";
  const productUrl = handle ? `https://${shopDomain}/products/${encodeURIComponent(handle)}` : null;

  const row = {
    shop_domain: shopDomain,
    shopify_product_id: productId,
    title: typeof product.title === "string" ? product.title.slice(0, 300) : "Untitled product",
    description: typeof product.body_html === "string" ? product.body_html.slice(0, 12000) : null,
    handle: handle || null,
    vendor: typeof product.vendor === "string" ? product.vendor.slice(0, 200) : null,
    product_type: typeof product.product_type === "string" ? product.product_type.slice(0, 200) : null,
    tags: asTags(product.tags).slice(0, 50),
    image_url: safeImage(product),
    product_url: productUrl,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    source_updated_at: product.updated_at ?? new Date().toISOString(),
    source_status: archived ? "archived" : (product.status ?? "unknown"),
    published_to_store: published,
    review_status: archived || !published ? "blocked" : "pending_review",
    block_reason: archived ? "product_archived" : !published ? "product_not_published" : null,
    last_webhook_topic: topic,
    last_webhook_at: new Date().toISOString(),
    payload_version: 1,
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("shopify_product_promotions")
      .upsert(row, { onConflict: "shop_domain,shopify_product_id" });
    if (error) {
      console.error("[shopify product webhook] persistence failed", error.message);
      return Response.json({ ok: false, error: "Could not persist product event" }, { status: 500 });
    }
    return Response.json({
      ok: true,
      received: true,
      reviewStatus: row.review_status,
      message: row.review_status === "pending_review"
        ? "Product queued for editorial review; it has not been published to NEWFIND."
        : "Product is not eligible for promotion until it is published and active in Shopify.",
    });
  } catch (error) {
    console.error("[shopify product webhook] handler failed", error);
    return Response.json({ ok: false, error: "Shopify integration unavailable" }, { status: 503 });
  }
}

export async function GET() {
  return Response.json({ ok: true, integration: "shopify-product-webhook", mode: "signed-webhook" });
}
