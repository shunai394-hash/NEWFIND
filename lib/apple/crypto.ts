import { createHash, randomBytes } from "crypto";

export function randomAppleValue() {
  return randomBytes(24).toString("hex");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
