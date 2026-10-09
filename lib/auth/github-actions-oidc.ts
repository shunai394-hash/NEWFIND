import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_AUDIENCE = "https://newfind-self.vercel.app";
const TRUSTED_REPOSITORY = "shunai394-hash/NEWFIND";
const TRUSTED_REF = "refs/heads/main";
const TRUSTED_SUBJECT = `repo:${TRUSTED_REPOSITORY}:ref:${TRUSTED_REF}`;
const TRUSTED_WORKFLOW_REF = `${TRUSTED_REPOSITORY}/.github/workflows/ai-patrol-schedule.yml@${TRUSTED_REF}`;
const GITHUB_JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

export function isTrustedGitHubActionsClaims(payload: JWTPayload): boolean {
  return (
    payload.iss === GITHUB_ISSUER &&
    payload.repository === TRUSTED_REPOSITORY &&
    payload.ref === TRUSTED_REF &&
    payload.sub === TRUSTED_SUBJECT &&
    payload.workflow_ref === TRUSTED_WORKFLOW_REF
  );
}

/**
 * Verify a GitHub Actions OIDC token for the single trusted NEWFIND patrol
 * workflow on main. This avoids copying CRON_SECRET into GitHub repository
 * secrets while keeping arbitrary callers locked out.
 */
export async function verifyTrustedGitHubActionsToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (!token || parts.length !== 3) return false;
  // Cheap untrusted-claim precheck avoids a JWKS network request for arbitrary
  // bearer strings; authorization still requires jwtVerify below.
  try {
    const unverified = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JWTPayload;
    if (!isTrustedGitHubActionsClaims(unverified)) return false;
  } catch {
    return false;
  }
  try {
    const { payload } = await jwtVerify(token, GITHUB_JWKS, {
      issuer: GITHUB_ISSUER,
      audience: GITHUB_AUDIENCE,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    return isTrustedGitHubActionsClaims(payload);
  } catch {
    return false;
  }
}
