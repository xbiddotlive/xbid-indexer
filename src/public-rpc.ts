import { createTransport, http, type Transport } from "viem";

export function assertScopedLogRequest(body: { method: string; params?: unknown }) {
  if (body.method !== "eth_getLogs") return;
  const filter = Array.isArray(body.params) ? body.params[0] : undefined;
  const addresses = typeof filter?.address === "string" ? [filter.address] : filter?.address;
  if (!Array.isArray(addresses) || addresses.length === 0 ||
      !addresses.every((address) => typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address))) {
    throw new Error("XBID refuses eth_getLogs without explicit contract addresses.");
  }
}

/** Detect throttling without logging URLs, headers or RPC request parameters. */
export function isRpcRateLimit(error: unknown): boolean {
  const seen = new Set<unknown>();
  let value = error;
  while (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    const item = value as { status?: number; code?: number; message?: string; cause?: unknown };
    if (item.status === 429 || item.code === -32005 || /\b429\b|rate.?limit|too many requests/i.test(item.message ?? "")) return true;
    value = item.cause;
  }
  return false;
}

/** One in-flight request, evenly spaced starts and a shared cooldown on 429.
 * Ponder owns retries; errors are never replaced with empty/successful results.
 */
export function createRpcScheduler(options: {
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
} = {}) {
  const intervalMs = options.intervalMs ?? 300;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let tail: Promise<unknown> = Promise.resolve();
  let nextAt = 0;
  let pending = 0;
  let consecutiveLimits = 0;
  const stats = { requests: 0, rateLimits: 0, errors: 0 };

  return {
    stats,
    run<T>(request: () => Promise<T>): Promise<T> {
      if (pending >= 512) return Promise.reject(new Error("Public RPC queue is full; retry after backpressure."));
      pending++;
      const result = tail.then(async () => {
        while (now() < nextAt) await sleep(nextAt - now());
        nextAt = now() + intervalMs;
        stats.requests++;
        try {
          const response = await request();
          consecutiveLimits = 0;
          return response;
        } catch (error) {
          stats.errors++;
          if (isRpcRateLimit(error)) {
            stats.rateLimits++;
            consecutiveLimits++;
            nextAt = Math.max(nextAt, now() + Math.min(30_000, 5_000 * 2 ** Math.min(consecutiveLimits - 1, 3)));
          }
          throw error;
        } finally {
          pending--;
        }
      });
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export function officialPublicRpc(url: string): Transport {
  return ({ chain, timeout }) => {
    const transport = http(url, { retryCount: 0, timeout: timeout ?? 10_000 })({ chain, retryCount: 0 });
    const scheduler = createRpcScheduler();
    let reportAt = Date.now() + 60_000;
    const methods: Record<string, number> = {};
    return createTransport({
      key: "xbid-public-rpc",
      name: "XBID paced public RPC",
      type: "http",
      retryCount: 0,
      request: (async (body: Parameters<typeof transport.request>[0]) => {
        assertScopedLogRequest(body);
        try {
          return await scheduler.run(() => {
            methods[body.method] = (methods[body.method] ?? 0) + 1;
            return transport.request(body);
          });
        } finally {
          if (Date.now() >= reportAt) {
            reportAt = Date.now() + 60_000;
            console.info(JSON.stringify({ event: "xbid_public_rpc_totals", ...scheduler.stats, methods }));
          }
        }
      }) as typeof transport.request,
    });
  };
}
