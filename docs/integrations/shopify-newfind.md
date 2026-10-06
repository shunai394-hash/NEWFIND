# Shopify → NEWFIND product promotion bridge

## Current behavior

- Receives Shopify `products/create`, `products/update`, and `products/delete` webhooks.
- Verifies Shopify's HMAC-SHA256 signature against the exact raw request body.
- Enforces a 1 MB streaming body limit and validates product IDs, shop hostnames, prices, and timestamps before persistence.
- Stores product descriptions as plain text, not executable source HTML.
- Handles Shopify's documented minimal `products/delete` payload (product ID only) using the delivery timestamp, while rejecting full product snapshots mislabeled as deletes.
- Accepts events only from `SHOPIFY_ALLOWED_SHOP_DOMAIN`.
- Upserts by `shop_domain + shopify_product_id`, so webhook retries do not create duplicate intake rows. The same delivery ID and stale/equal timestamps cannot mutate an existing row.
- Stores product facts in the private `shopify_product_promotions` review queue.
- A product is eligible for editorial review only when Shopify reports it active and published. Archived, draft, and unpublished products are blocked.
- Does **not** publish directly to the NEWFIND timeline. Editorial quality, duplicate, image, product-link, and resident-fit checks must pass before a separate publish action is enabled.

## Environment variables

Set these in the NEWFIND Vercel project (Production and Preview as appropriate):

- `SHOPIFY_WEBHOOK_SECRET`: the signing secret used for Shopify webhooks.
- `SHOPIFY_ALLOWED_SHOP_DOMAIN`: exact shop domain, e.g. `your-shop.myshopify.com`.
- Existing server-only `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for persistence. Never expose the service-role key to the browser.

## Shopify webhook setup

Register HTTPS webhook subscriptions for these topics, pointing to:

`https://newfind-self.vercel.app/api/integrations/shopify/products`

- `products/create`
- `products/update`
- `products/delete`

Use the same webhook signing secret as `SHOPIFY_WEBHOOK_SECRET`. The route accepts signed POST requests only for product events; GET is a non-sensitive liveness check.

## Deployment checklist

1. Apply the migration `supabase/migrations/20261006120000_shopify_product_promotions.sql` to the NEWFIND Supabase project.
2. Configure the two Shopify environment variables in Vercel and redeploy.
3. Register the three Shopify webhook subscriptions.
4. Create or update one active, published test product in Shopify.
5. Confirm one queue row appears; replay the same webhook and confirm the row count stays unchanged.
6. Verify draft/unpublished/archive events become blocked.
7. Only then implement/enable the NEWFIND editorial review UI and publish path. Do not bypass resident identity, craft/bottle exclusion, duplicate suppression, or existing post-quality gates.

## Customer-facing principle

Shopify remains the source of truth for product facts and checkout. NEWFIND is the discovery and storytelling surface. AI may explain why a product is interesting, but must not invent prices, stock, origin, performance, or claims that are absent from the source data.
