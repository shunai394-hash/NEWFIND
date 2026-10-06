import { createAdminClient } from "@/lib/supabase/admin";
import { mediaObjectPath } from "@/lib/media-storage";
import { APPLE_BUNDLE_ID } from "@/lib/apple/config";
import { createAppleClientSecret } from "@/lib/apple/client-secret";
import { revokeAppleToken } from "@/lib/apple/revoke";
import { loadAppleRefreshTokens } from "@/lib/apple/token-store";
import {
  AppleTokenEndpointError,
  exchangeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} from "@/lib/apple/verify";
import {
  AppleCodeExchangeError,
  deleteAccountAsAdmin,
  deleteOwnAccount,
  type DeleteAccountDeps,
  type DeleteAccountResult,
  type SelfDeleteOptions,
} from "@/lib/account/delete-account-core";

export { AccountDeletionError } from "@/lib/account/delete-account-core";
export type { DeleteAccountResult } from "@/lib/account/delete-account-core";

const STORAGE_REMOVE_CHUNK = 100;

function uniquePaths(paths: Array<string | null>): string[] {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

async function collectOwnedMediaPaths(userId: string) {
  const admin = createAdminClient();
  const [profile, posts] = await Promise.all([
    admin.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
    admin.from("posts").select("media_url, thumbnail_url").eq("author_id", userId),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (posts.error) throw new Error(posts.error.message);

  return uniquePaths([
    mediaObjectPath(profile.data?.avatar_url),
    ...(posts.data ?? []).flatMap((post) => [
      mediaObjectPath(post.media_url),
      mediaObjectPath(post.thumbnail_url),
    ]),
    `profile-meta/${userId}.json`,
  ]);
}

async function removeOwnedMedia(paths: string[]) {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  const errors: string[] = [];
  for (const group of chunk(paths, STORAGE_REMOVE_CHUNK)) {
    const { error } = await admin.storage.from("media").remove(group);
    if (error) errors.push(error.message);
  }
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}

/** Every Apple ID linked to the user, from all places sign-in records it. */
async function linkedAppleUserIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const ids = new Set<string>();
  const [identities, profile, authUser] = await Promise.all([
    admin.from("apple_identities").select("apple_user_id").eq("user_id", userId),
    admin.from("profiles").select("apple_user_id").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  // A genuinely deleted user has nothing left to revoke. For any other lookup
  // failure, fail closed: treating a database/auth outage as "not linked" would
  // allow account deletion without checking Apple's authorization.
  if (authUser.error) {
    if (authUser.error.status === 404 || /not.?found/i.test(authUser.error.message)) return [];
    throw new Error("Apple identity lookup failed");
  }
  const authUserData = authUser.data.user;
  if (!authUserData) return [];
  const metaAppleId = authUserData.user_metadata?.apple_user_id;
  const hasMetadataAppleId = typeof metaAppleId === "string" && metaAppleId.length > 0;

  // Older deployments may lack one of the legacy identity columns/tables.
  // The verified auth metadata is an acceptable fallback; without it, a failed
  // lookup cannot safely prove that the user has no Apple identity.
  if (identities.error && !hasMetadataAppleId) {
    throw new Error("Apple identity lookup failed");
  }
  if (profile.error && !hasMetadataAppleId && !(identities.data ?? []).some((row) => row.apple_user_id)) {
    throw new Error("Apple identity lookup failed");
  }

  for (const row of identities.data ?? []) {
    if (row.apple_user_id) ids.add(String(row.apple_user_id));
  }
  const profileAppleId = (profile.data as { apple_user_id?: string | null } | null)?.apple_user_id;
  if (profileAppleId) ids.add(profileAppleId);
  if (hasMetadataAppleId) ids.add(metaAppleId);
  return [...ids];
}

const deps: DeleteAccountDeps = {
  linkedAppleUserIds,
  loadAppleTokens: loadAppleRefreshTokens,
  exchangeAppleCode: async (code) => {
    // Re-authorization only happens in the iOS app, so the client is the bundle id.
    let tokens: Awaited<ReturnType<typeof exchangeAppleAuthorizationCode>>;
    try {
      await createAppleClientSecret(APPLE_BUNDLE_ID);
    } catch {
      throw new AppleCodeExchangeError("config");
    }
    try {
      tokens = await exchangeAppleAuthorizationCode({
        code,
        clientId: APPLE_BUNDLE_ID,
        redirectUri: null,
      });
    } catch (error) {
      if (error instanceof AppleTokenEndpointError) {
        if (error.status === 429 || error.status >= 500) throw new AppleCodeExchangeError("transient");
        if (error.oauthError === "invalid_client" || error.oauthError === "unauthorized_client") {
          throw new AppleCodeExchangeError("config");
        }
        throw new AppleCodeExchangeError("invalid_code");
      }
      throw new AppleCodeExchangeError("transient");
    }
    let identity: Awaited<ReturnType<typeof verifyAppleIdentityToken>>;
    try {
      identity = await verifyAppleIdentityToken({
        idToken: tokens.id_token,
        audience: [APPLE_BUNDLE_ID],
      });
    } catch {
      throw new AppleCodeExchangeError("invalid_code");
    }
    return {
      appleUserId: identity.sub,
      clientId: APPLE_BUNDLE_ID,
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token ?? null,
    };
  },
  revokeAppleToken: (input) =>
    revokeAppleToken(input, {
      fetch: (...args) => fetch(...args),
      createClientSecret: createAppleClientSecret,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
  collectMediaPaths: collectOwnedMediaPaths,
  removeMedia: removeOwnedMedia,
  deleteAuthUser: async (userId) => {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (!error) return "deleted";
    if (error.status === 404 || /not.?found/i.test(error.message)) return "not_found";
    throw new Error("auth user delete failed");
  },
};

/** A signed-in user deleting their own account (userId from the verified session). */
export function deleteOwnedAccount(
  userId: string,
  options: SelfDeleteOptions = {},
): Promise<DeleteAccountResult> {
  return deleteOwnAccount(userId, options, deps);
}

/** Admin deletion of another user. Only call after requireAdmin. */
export function deleteAccountByAdmin(userId: string): Promise<DeleteAccountResult> {
  return deleteAccountAsAdmin(userId, deps);
}
