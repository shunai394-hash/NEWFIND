import { SignJWT, importPKCS8 } from "jose";
import {
  APPLE_ISSUER,
  APPLE_KEY_ID,
  APPLE_TEAM_ID,
  applePrivateKeyPem,
} from "@/lib/apple/config";

export async function createAppleClientSecret(clientId: string) {
  const pem = applePrivateKeyPem();
  if (!pem || !APPLE_KEY_ID) {
    throw new Error("Apple の秘密鍵または Key ID が未設定です");
  }
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(APPLE_ISSUER)
    .setSubject(clientId)
    .sign(key);
}
