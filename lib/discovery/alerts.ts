import { createAdminClient } from "@/lib/supabase/admin";
import { getDiscoveryProductFromDb } from "@/lib/discovery/db";
import { JAPAN_SEED_PRODUCTS } from "@/lib/discovery/japan-seed";
import type { AlertType } from "@/lib/discovery/types";

export type UserAlert = {
  id: string;
  userId: string;
  alertType: AlertType;
  productId: string | null;
  brand: string | null;
  personName: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  productId: string | null;
  postId: string | null;
  readAt: string | null;
  createdAt: string;
};

function db() {
  return createAdminClient();
}

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /user_alerts|notifications|schema cache|42P01/i.test(message);
}

type AlertRow = {
  id: string;
  user_id: string;
  alert_type: string;
  product_id: string | null;
  brand: string | null;
  person_name: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  product_id: string | null;
  post_id?: string | null;
  read_at: string | null;
  created_at: string;
};

function mapAlert(row: AlertRow): UserAlert {
  return {
    id: row.id,
    userId: row.user_id,
    alertType: row.alert_type as AlertType,
    productId: row.product_id,
    brand: row.brand,
    personName: row.person_name,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body ?? "",
    productId: row.product_id,
    postId: row.post_id ?? null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listUserAlerts(userId: string): Promise<UserAlert[]> {
  const { data, error } = await db()
    .from("user_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as AlertRow[]).map(mapAlert);
}

export async function setAlertEnabled(userId: string, alertId: string, isEnabled: boolean) {
  const { data, error } = await db()
    .from("user_alerts")
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAlert(data as AlertRow) : null;
}

async function findAlert(input: {
  userId: string;
  alertType: AlertType;
  productId?: string | null;
  brand?: string | null;
  personName?: string | null;
}) {
  let query = db()
    .from("user_alerts")
    .select("*")
    .eq("user_id", input.userId)
    .eq("alert_type", input.alertType);
  if (input.productId) query = query.eq("product_id", input.productId);
  else query = query.is("product_id", null);
  if (input.brand) query = query.eq("brand", input.brand);
  else query = query.is("brand", null);
  if (input.personName) query = query.eq("person_name", input.personName);
  else query = query.is("person_name", null);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapAlert(data as AlertRow) : null;
}

async function upsertAlert(input: {
  userId: string;
  alertType: AlertType;
  productId?: string | null;
  brand?: string | null;
  personName?: string | null;
  isEnabled?: boolean;
}) {
  const existing = await findAlert(input);
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await db()
      .from("user_alerts")
      .update({ is_enabled: input.isEnabled ?? true, updated_at: now })
      .eq("id", existing.id);
    if (error && !missingTable(error)) throw new Error(error.message);
    return;
  }
  const { error } = await db().from("user_alerts").insert({
    user_id: input.userId,
    alert_type: input.alertType,
    product_id: input.productId ?? null,
    brand: input.brand ?? null,
    person_name: input.personName ?? null,
    is_enabled: input.isEnabled ?? true,
    updated_at: now,
  });
  if (error) {
    if (missingTable(error) || /duplicate|23505/i.test(error.message)) return;
    throw new Error(error.message);
  }
}

export async function enableSaveAlerts(userId: string, productId: string) {
  let brand: string | null = null;
  try {
    const product = await getDiscoveryProductFromDb(productId, true);
    brand = product?.brand ?? null;
  } catch {
    brand = null;
  }
  if (!brand) {
    brand = JAPAN_SEED_PRODUCTS.find((item) => item.id === productId)?.brand ?? null;
  }
  await upsertAlert({
    userId,
    alertType: "trending",
    productId,
    isEnabled: true,
  });
  if (brand) {
    await upsertAlert({
      userId,
      alertType: "new_product",
      brand,
      isEnabled: true,
    });
  }
}

export async function disableProductTrendingAlert(userId: string, productId: string) {
  const { error } = await db()
    .from("user_alerts")
    .update({ is_enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("alert_type", "trending")
    .eq("product_id", productId);
  if (error && !missingTable(error)) throw new Error(error.message);
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  await syncTrendingAlertNotifications(userId).catch(() => undefined);
  const { data, error } = await db()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const { data, error } = await db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapNotification(data as NotificationRow) : null;
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  productId?: string | null;
  postId?: string | null;
}) {
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    product_id: input.productId ?? null,
  };
  if (input.postId) payload.post_id = input.postId;
  const { data, error } = await db().from("notifications").insert(payload).select("*").maybeSingle();
  if (error) {
    if (input.postId && /post_id|schema cache|42703/i.test(error.message)) {
      delete payload.post_id;
      const retry = await db().from("notifications").insert(payload).select("*").maybeSingle();
      if (retry.error) {
        if (missingTable(retry.error)) return null;
        throw new Error(retry.error.message);
      }
      return retry.data ? mapNotification(retry.data as NotificationRow) : null;
    }
    if (missingTable(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapNotification(data as NotificationRow) : null;
}

export async function notifySocialEvent(input: {
  actorId: string;
  type: "like" | "follow" | "comment";
  postId?: string;
  targetUserId?: string;
}) {
  if (input.type === "follow") {
    const target = input.targetUserId;
    if (!target || target === input.actorId) return null;

    return createNotification({
      userId: target,
      type: "follow",
      title: "New follower",
      body: "Someone followed you",
    });
  }

  if (!input.postId) return null;

  const { data: post } = await db()
    .from("posts")
    .select("id, author_id")
    .eq("id", input.postId)
    .maybeSingle();

  const authorId = (post as { author_id?: string } | null)?.author_id;

  if (!authorId || authorId === input.actorId) return null;

  if (input.type === "like") {
    return createNotification({
      userId: authorId,
      type: "like",
      title: "Like",
      body: "Someone liked your post",
      postId: input.postId,
    });
  }

  return createNotification({
    userId: authorId,
    type: "comment",
    title: "Comment",
    body: "Someone commented on your post",
    postId: input.postId,
  });
}
async function recentNotificationExists(
  userId: string,
  type: string,
  productId: string,
  sinceIso: string,
) {
  const { data, error } = await db()
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("product_id", productId)
    .gte("created_at", sinceIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (missingTable(error)) return true;
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function syncTrendingAlertNotifications(userId: string) {
  const alerts = await listUserAlerts(userId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const alert of alerts) {
    if (!alert.isEnabled || alert.alertType !== "trending" || !alert.productId) {
      continue;
    }

    let name = alert.brand ?? "Saved product";
    let score = 0;

    try {
      const product = await getDiscoveryProductFromDb(alert.productId, true);

      if (product) {
        name = `${product.brand} ${product.productName}`.trim();
        score = product.trendScore ?? 0;
      }
    } catch {
      score = 0;
    }

    if (score < 60) continue;

    if (
      await recentNotificationExists(
        userId,
        "trending",
        alert.productId,
        since,
      )
    ) {
      continue;
    }

    await createNotification({
      userId,
      type: "trending",
      title: "Trending up",
      body: `${name} is gaining attention`,
      productId: alert.productId,
    });
  }
}