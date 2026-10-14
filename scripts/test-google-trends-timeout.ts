import { getGoogleTrends } from "../lib/ai/google-trends";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const controller = new AbortController();
  let observedSignal: AbortSignal | null = null;
  let timeoutMs = 0;

  (AbortSignal as unknown as { timeout: (milliseconds: number) => AbortSignal }).timeout = (milliseconds) => {
    timeoutMs = milliseconds;
    return controller.signal;
  };

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    observedSignal = init?.signal as AbortSignal | null;
    return await new Promise<Response>((_resolve, reject) => {
      if (observedSignal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      observedSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  }) as typeof fetch;

  try {
    const pending = getGoogleTrends(2, "ZZ_TEST");
    await Promise.resolve();
    assert(timeoutMs === 8_000, "Google Trends fetch must use the configured 8-second deadline");
    assert(observedSignal === controller.signal, "the fetch must receive the deadline signal");
    controller.abort();
    const result = await pending;
    assert(result.length === 0, "an aborted RSS request should fail closed to an empty trend list");
    assert(controller.signal.aborted, "the simulated deadline must cancel the pending fetch");
  } finally {
    globalThis.fetch = originalFetch;
    (AbortSignal as unknown as { timeout: typeof AbortSignal.timeout }).timeout = originalTimeout;
  }

  console.log("Google Trends fetch deadline test passed");
}

void main();
