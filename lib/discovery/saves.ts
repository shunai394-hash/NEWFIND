import { createAdminClient } from "@/lib/supabase/admin";
import { enableSaveAlerts, disableProductTrendingAlert } from "@/lib/discovery/alerts";
import { listDiscoveryProductsByIdsFromDb } from "@/lib/discovery/db";
import { JAPAN_SEED_PRODUCTS } from "@/lib/discovery/japan-seed";
import { isUsableProductImage } from "@/lib/discovery/media";
import type { DiscoveryProduct } from "@/lib/discovery/types";

function db() {
  return createAdminClient();
}

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /discovery_product_saves|schema cache|42P01/i.test(message);
}

export type ProductSaveState = {
  saved: boolean;
  productId: string;
};

export async function listSavedProductIds(userId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("discovery_product_saves")
    .select("product_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => String((row as { product_id: string }).product_id));
}

export async function listSavedProducts(userId: string): Promise<DiscoveryProduct[]> {
  const ids = await listSavedProductIds(userId);
  const fromDb = await listDiscoveryProductsByIdsFromDb(ids, { requireImage: true });
  const byId = new Map(fromDb.map((item) => [item.id, item]));
  for (const id of ids) {
    if (byId.has(id)) continue;
    const seeded = JAPAN_SEED_PRODUCTS.find((item) => item.id === id);
    if (seeded && isUsableProductImage(seeded.productImageUrl)) byId.set(id, seeded);
  }
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is DiscoveryProduct => {
      if (!item) return false;
      return isUsableProductImage(item.productImageUrl);
    });
}

export async function isProductSaved(userId: string, productId: string) {
  const { data, error } = await db()
    .from("discovery_product_saves")
    .select("product_id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return false;
    throw new Error(error.message);
  }
  return Boolean(data);
}

export async function toggleProductSave(userId: string, productId: string): Promise<ProductSaveState> {
  const existing = await isProductSaved(userId, productId);
  if (existing) {
    const { error } = await db()
      .from("discovery_product_saves")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw new Error(error.message);
    await disableProductTrendingAlert(userId, productId);
    return { saved: false, productId };
  }

  const { error } = await db().from("discovery_product_saves").insert({
    user_id: userId,
    product_id: productId,
  });
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return { saved: true, productId };
    }
    throw new Error(error.message);
  }
  await enableSaveAlerts(userId, productId);
  return { saved: true, productId };
}
