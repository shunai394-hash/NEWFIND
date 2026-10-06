export type BoundedWebhookBody = { body: Uint8Array } | { tooLarge: true };

/** Read a request body with a hard byte cap, preserving the exact signed bytes. */
export async function readBoundedWebhookBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedWebhookBody> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer");
  }

  const reader = request.body?.getReader();
  if (!reader) return { body: new Uint8Array() };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { tooLarge: true };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body };
}
