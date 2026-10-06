import { readBoundedWebhookBody } from "@/lib/shopify-webhook-body";
import { isShopifyMyshopifyDomain, normalizeShopifyDescription, normalizeShopifyPrice, normalizeShopifyProductId, resolveShopifyEventTimestamp } from "@/lib/shopify-webhook-payload";
import { verifyShopifyWebhookHmac } from "@/lib/shopify-webhook-security";
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
  if (!secret || !allowedShop || !isShopifyMyshopifyDomain(allowedShop)) {
    return Response.json({ ok: false, error: "Shopify integration is not configured" }, { status: 503 });
  }

  const shopDomain = request.headers.get("x-shopify-shop-domain")?.trim().toLowerCase() ?? "";
  const topic = request.headers.get("x-shopify-topic")?.trim().toLowerCase() ?? "";
  const signature = request.headers.get("x-shopify-hmac-sha256")?.trim() ?? "";
  const webhookId = request.headers.get("x-shopify-webhook-id")?.trim() ?? "";

  if (!isShopifyMyshopifyDomain(shopDomain) || shopDomain !== allowedShop) {
    return Response.json({ ok: false, error: "Shop is not allowed" }, { status: 401 });
  }
  if (!["products/create", "products/update", "products/delete"].includes(topic)) {
    return Response.json({ ok: false, error: "Unsupported topic" }, { status: 400 });
  }

  const rawBodyResult = await readBoundedWebhookBody(request, MAX_BODY_BYTES);
  if ("tooLarge" in rawBodyResult) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }
  const rawBody = rawBodyResult.body;
  if (!verifyShopifyWebhookHmac(rawBody, secret, signature)) {
    return Response.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  }
  if (!webhookId || webhookId.length > 255) {
    return Response.json({ ok: false, error: "Missing or invalid webhook delivery id" }, { status: 400 });
  }

  let product: ShopifyProductWebhook;
  try {
    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    product = JSON.parse(rawText) as ShopifyProductWebhook;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON or UTF-8 payload" }, { status: 400 });
  }
  const productId = normalizeShopifyProductId(product.id);
  if (!productId) {
    return Response.json({ ok: false, error: "Missing or invalid product id" }, { status: 400 });
  }
  const triggeredAt = request.headers.get("x-shopify-triggered-at")?.trim() ?? "";
  if (topic === "products/delete" && (
    product.updated_at != null || product.title != null || product.status != null ||
    product.variants != null || product.image != null || product.images != null
  )) {
    return Response.json({ ok: false, error: "Delete topic payload is not the expected minimal product tombstone" }, { status: 400 });
  }
  const sourceUpdatedAt = resolveShopifyEventTimestamp(topic, product.updated_at, triggeredAt);
  if (!sourceUpdatedAt) {
    return Response.json({ ok: false, error: "Missing or invalid product event timestamp" }, { status: 400 });
  }
  const archived = topic === "products/delete" || product.status === "archived";
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const prices = variants
    .map((variant) => normalizeShopifyPrice(variant.price))
    .filter((price): price is number => price !== null);
  const published = !archived && product.status === "active" && Boolean(product.published_at);
  const handle = typeof product.handle === "string" ? product.handle.trim() : "";
  const productUrl = handle ? `https://${shopDomain}/products/${encodeURIComponent(handle)}` : null;

  const row = {
    shop_domain: shopDomain,
    shopify_product_id: productId,
    title: typeof product.title === "string" ? product.title.slice(0, 300) : "Untitled product",
    description: normalizeShopifyDescription(product.body_html),
    handle: handle || null,
    vendor: typeof product.vendor === "string" ? product.vendor.slice(0, 200) : null,
    product_type: typeof product.product_type === "string" ? product.product_type.slice(0, 200) : null,
    tags: asTags(product.tags).slice(0, 50),
    image_url: safeImage(product),
    product_url: productUrl,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    source_updated_at: sourceUpdatedAt,
    source_status: archived ? "archived" : (product.status ?? "unknown"),
    published_to_store: published,
    review_status: archived || !published ? "blocked" : "pending_review",
    block_reason: archived ? "product_archived" : !published ? "product_not_published" : null,
    last_webhook_topic: topic,
    last_webhook_id: webhookId,
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
  const configured = Boolean(
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() &&
    process.env.SHOPIFY_ALLOWED_SHOP_DOMAIN?.trim(),
  );
  return Response.json(
    {
      ok: configured,
      integration: "shopify-product-webhook",
      mode: "signed-webhook",
      readiness: configured ? "configured" : "missing_environment",
    },
    { status: configured ? 200 : 503 },
  );
}
