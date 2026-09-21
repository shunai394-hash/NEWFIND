export type IntegrationConfig = {
  sharedSecret: string;
  integrationKey: string;
  tracerIngestUrl: string;
  timestampSkewSec: number;
  maxAttempts: number;
};

export function getIntegrationConfig(): IntegrationConfig {
  const sharedSecret =
    process.env.INTEGRATION_HMAC_SECRET?.trim() ||
    process.env.NEWFIND_TRACER_SHARED_SECRET?.trim() ||
    process.env.TRACER_WEBHOOK_SECRET?.trim() ||
    "";
  const integrationKey =
    process.env.INTEGRATION_KEY?.trim() ||
    process.env.NEWFIND_INTEGRATION_KEY?.trim() ||
    "newfind-tracer";
  const tracerIngestUrl =
    process.env.TRACER_INGEST_URL?.trim() ||
    process.env.TRACER_WEBHOOK_URL?.trim() ||
    "";
  const skew = Number(process.env.INTEGRATION_TIMESTAMP_SKEW_SEC ?? "300");
  const maxAttempts = Number(process.env.INTEGRATION_MAX_ATTEMPTS ?? "8");
  return {
    sharedSecret,
    integrationKey,
    tracerIngestUrl,
    timestampSkewSec: Number.isFinite(skew) && skew > 0 ? skew : 300,
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 8,
  };
}

export function isOutboundConfigured() {
  const cfg = getIntegrationConfig();
  return Boolean(cfg.tracerIngestUrl && cfg.sharedSecret);
}

export function isInboundConfigured() {
  return Boolean(getIntegrationConfig().sharedSecret);
}