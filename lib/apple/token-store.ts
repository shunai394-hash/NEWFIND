import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only storage for Sign in with Apple refresh tokens, used to revoke
 * the user's authorization when they delete their account.
 * Tokens are AES-256-GCM encrypted before they reach the database, and the
 * table is service-role only (see 20261004090000_apple_auth_tokens.sql).
 */

const VERSION = "v1";

export type StoredAppleToken = {
  appleUserId: string;
  clientId: string;
  refreshToken: string;
};

function encryptionKey(): Buffer | null {
  const secret =
    process.env.APPLE_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!secret) return null;
  return createHash("sha256").update(`newfind:apple-refresh-token:${VERSION}:${secret}`).digest();
}

export function encryptAppleToken(token: string, key: Buffer | null = encryptionKey()): string {
  if (!key) throw new Error("apple token encryption key is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptAppleToken(payload: string, key: Buffer | null = encryptionKey()): string {
  if (!key) throw new Error("apple token encryption key is not configured");
  const [version, iv, tag, body] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("unsupported apple token format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

/** Best effort: sign-in must not fail because a token could not be stored. */
export async function saveAppleRefreshToken(input: {
  userId: string;
  appleUserId: string;
  clientId: string;
  refreshToken: string | null | undefined;
}): Promise<boolean> {
  if (!input.refreshToken) return false;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("apple_auth_tokens").upsert(
      {
        user_id: input.userId,
        apple_user_id: input.appleUserId,
        client_id: input.clientId,
        refresh_token_ciphertext: encryptAppleToken(input.refreshToken),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,apple_user_id,client_id" },
    );
    if (error) {
      console.warn("[apple] refresh token not stored:", error.code ?? "db_error");
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[apple] refresh token not stored:", error instanceof Error ? error.name : "error");
    return false;
  }
}

export async function loadAppleRefreshTokens(userId: string): Promise<StoredAppleToken[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("apple_auth_tokens")
    .select("apple_user_id, client_id, refresh_token_ciphertext")
    .eq("user_id", userId);
  if (error) {
    // Table not migrated yet: behave as "no stored token" (re-authorization path).
    if (/apple_auth_tokens|does not exist|schema cache|42P01/i.test(error.message)) return [];
    throw new Error("apple token lookup failed");
  }
  const tokens: StoredAppleToken[] = [];
  for (const row of data ?? []) {
    try {
      tokens.push({
        appleUserId: String(row.apple_user_id),
        clientId: String(row.client_id),
        refreshToken: decryptAppleToken(String(row.refresh_token_ciphertext)),
      });
    } catch {
      // Undecryptable (rotated key): treated as missing; re-authorization covers it.
    }
  }
  return tokens;
}

export async function deleteAppleRefreshTokens(userId: string) {
  const admin = createAdminClient();
  await admin.from("apple_auth_tokens").delete().eq("user_id", userId);
}
