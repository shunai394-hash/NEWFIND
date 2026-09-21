import { createHmac, timingSafeEqual } from "crypto";
import { getIntegrationConfig } from "./config";

export type SignedHeaders = {
  key: string;
  timestamp: string;
  eventId: string;
  signature: string;
};

export function signingPayload(timestamp: string, eventId: string, rawBody: string) {
  return `${timestamp}.${eventId}.${rawBody}`;
}

export function signIntegrationBody(input: {
  secret: string;
  timestamp: string;
  eventId: string;
  rawBody: string;
}) {
  return createHmac("sha256", input.secret)
    .update(signingPayload(input.timestamp, input.eventId, input.rawBody), "utf8")
    .digest("hex");
}

export function buildSignedHeaders(input: {
  eventId: string;
  rawBody: string;
  key?: string;
  secret?: string;
  timestamp?: string;
}): SignedHeaders {
  const cfg = getIntegrationConfig();
  const secret = input.secret ?? cfg.sharedSecret;
  const key = input.key ?? cfg.integrationKey;
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = signIntegrationBody({
    secret,
    timestamp,
    eventId: input.eventId,
    rawBody: input.rawBody,
  });
  return { key, timestamp, eventId: input.eventId, signature };
}

export function headersFromSigned(signed: SignedHeaders): Record<string, string> {
  return {
    "X-Integration-Key": signed.key,
    "X-Integration-Timestamp": signed.timestamp,
    "X-Integration-Id": signed.eventId,
    "X-Integration-Signature": signed.signature,
  };
}

function safeEqualString(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type AuthResult =
  | { ok: true; mode: "hmac" | "bearer" }
  | { ok: false; status: number; error: string };

/**
 * Prefer HMAC-SHA256. Also accept legacy Bearer / x-newfind-secret /
 * x-tracer-secret equal to the shared secret so current TRACER can deliver.
 */
export function verifyIntegrationRequest(input: {
  headers: Headers;
  rawBody: string;
  eventId: string;
}): AuthResult {
  const cfg = getIntegrationConfig();
  if (!cfg.sharedSecret) {
    return { ok: false, status: 503, error: "integration secret not configured" };
  }

  const sig =
    input.headers.get("x-integration-signature") ||
    input.headers.get("X-Integration-Signature");
  const ts =
    input.headers.get("x-integration-timestamp") ||
    input.headers.get("X-Integration-Timestamp");
  const idHeader =
    input.headers.get("x-integration-id") ||
    input.headers.get("X-Integration-Id") ||
    input.eventId;
  const key =
    input.headers.get("x-integration-key") ||
    input.headers.get("X-Integration-Key");

  if (sig && ts) {
    const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
    if (!Number.isFinite(Number(ts)) || skew > cfg.timestampSkewSec) {
      return { ok: false, status: 401, error: "timestamp skew too large" };
    }
    if (key && key !== cfg.integrationKey) {
      return { ok: false, status: 401, error: "invalid integration key" };
    }
    if (idHeader !== input.eventId) {
      return { ok: false, status: 401, error: "integration id mismatch" };
    }
    const expected = signIntegrationBody({
      secret: cfg.sharedSecret,
      timestamp: ts,
      eventId: input.eventId,
      rawBody: input.rawBody,
    });
    if (expected.toLowerCase() !== sig.trim().toLowerCase()) {
      return { ok: false, status: 401, error: "invalid signature" };
    }
    return { ok: true, mode: "hmac" };
  }

  const bearer =
    input.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    input.headers.get("x-newfind-secret")?.trim() ||
    input.headers.get("x-tracer-secret")?.trim() ||
    "";
  if (bearer && safeEqualString(bearer, cfg.sharedSecret)) {
    return { ok: true, mode: "bearer" };
  }

  return { ok: false, status: 401, error: "unauthorized" };
}