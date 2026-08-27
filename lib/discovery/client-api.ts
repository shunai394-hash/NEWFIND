import { authHeaders } from "@/lib/auth/client-headers";
import type {
  DiscoveryProduct,
  DiscoveryProductInput,
  DiscoveryStatus,
} from "@/lib/discovery/types";

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Request failed",
    );
  }
  return body;
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const auth = await authHeaders();
  Object.entries(auth).forEach(([key, value]) => {
    if (typeof value === "string") headers.set(key, value);
  });
  return fetch(input, { ...init, headers });
}

export async function fetchDiscoveryList(status: DiscoveryStatus | "all" = "all") {
  const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const body = await readJson(
    await authFetch(`/api/discovery${query}`, { cache: "no-store" }),
  );
  return {
    products: (body.products ?? []) as DiscoveryProduct[],
    admin: Boolean(body.admin),
  };
}

export async function fetchDiscoveryProduct(id: string) {
  const response = await authFetch(`/api/discovery/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  const body = await readJson(response);
  return (body.product ?? null) as DiscoveryProduct | null;
}

export async function saveDiscoveryProductApi(input: DiscoveryProductInput) {
  const body = await readJson(
    await authFetch("/api/discovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return body.product as DiscoveryProduct;
}

export async function patchDiscoveryProduct(
  id: string,
  input: Partial<DiscoveryProductInput> & { status?: DiscoveryStatus },
) {
  const body = await readJson(
    await authFetch(`/api/discovery/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return body.product as DiscoveryProduct;
}

export async function fetchSavedProducts() {
  const body = await readJson(
    await authFetch("/api/discovery/saves?hydrate=1", { cache: "no-store" }),
  );
  return {
    productIds: (body.productIds ?? []) as string[],
    products: (body.products ?? []) as DiscoveryProduct[],
  };
}

export async function fetchProductSaveState(productId: string) {
  const body = await readJson(
    await authFetch(`/api/discovery/saves?productId=${encodeURIComponent(productId)}`, {
      cache: "no-store",
    }),
  );
  return Boolean(body.saved);
}

export async function toggleProductSaveApi(productId: string) {
  const body = await readJson(
    await authFetch("/api/discovery/saves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
    }),
  );
  return Boolean(body.saved);
}

export async function fetchUserAlerts() {
  const body = await readJson(await authFetch("/api/alerts", { cache: "no-store" }));
  return (body.alerts ?? []) as Array<{
    id: string;
    alertType: string;
    productId: string | null;
    brand: string | null;
    isEnabled: boolean;
  }>;
}

export async function patchUserAlert(id: string, isEnabled: boolean) {
  const body = await readJson(
    await authFetch("/api/alerts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, isEnabled }),
    }),
  );
  return body.alert;
}
