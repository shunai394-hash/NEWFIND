import { createClient as createJwtClient } from "@supabase/supabase-js";
import { isDiscoveryAdmin } from "@/lib/discovery/admin";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

export type RequestAuth = {
  user: User | null;
  userId: string | null;
  email: string | null;
  admin: boolean;
};

function bearerToken(request?: Request) {
  if (!request) return "";
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export async function getRequestAuth(request?: Request): Promise<RequestAuth> {
  if (!isSupabaseConfigured()) {
    return { user: null, userId: null, email: null, admin: true };
  }

  let user: User | null = null;
  const token = bearerToken(request);
  if (token) {
    try {
      const client = createJwtClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data } = await client.auth.getUser(token);
      user = data.user ?? null;
    } catch {
      user = null;
    }
  }

  if (!user) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user ?? null;
    } catch {
      user = null;
    }
  }

  const email = user?.email ?? null;
  let flag = false;
  let suspended = false;
  if (user?.id) {
    try {
      const admin = createAdminClient();
      const profile = await admin
        .from("profiles")
        .select("is_admin, is_suspended")
        .eq("id", user.id)
        .maybeSingle();
      const row = profile.data as { is_admin?: boolean; is_suspended?: boolean } | null;
      flag = Boolean(row?.is_admin);
      suspended = Boolean(row?.is_suspended);
    } catch {
      flag = false;
    }
  }

  return {
    user,
    userId: user?.id ?? null,
    email,
    admin: !suspended && isDiscoveryAdmin(email, flag),
  };
}

export async function requireUser(request?: Request) {
  const auth = await getRequestAuth(request);
  if (!isSupabaseConfigured()) return auth;
  if (!auth.userId) {
    const error = new Error("unauthorized");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return auth;
}

export async function requireAdmin(request?: Request) {
  const auth = await requireUser(request);
  if (!auth.admin) {
    const error = new Error("forbidden");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  return auth;
}

export function authErrorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: number }).status) || 400
    : 400;
  const message = error instanceof Error ? error.message : "request failed";
  return { status: status === 401 || status === 403 ? status : 400, message };
}
