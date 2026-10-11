import { getGoogleTrends } from "../lib/ai/google-trends";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const originalFetch = globalThis.fetch;
  let observedSignal: AbortSignal | null | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    observedSignal = init?.signal as AbortSignal | null | undefined;
    throw new Error("simulated_network_failure");
  }) as typeof fetch;

  try {
    const result = await getGoogleTrends(2, "ZZ_TEST");
    assert(result.length === 0, "a failed RSS request should fail closed to an empty trend list");
    assert(observedSignal instanceof AbortSignal, "Google Trends fetch must receive an abort signal with a deadline");
    assert(!observedSignal.aborted, "the deadline signal should not be pre-aborted for a fast failure");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Google Trends fetch deadline test passed");
}

void main();
