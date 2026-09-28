import assert from "node:assert/strict";
import { test } from "node:test";
import { assertScopedLogRequest, createInflightCoalescer, createRpcScheduler, isRpcRateLimit } from "../src/public-rpc";

function fixture() {
  let time = 0;
  const starts: number[] = [];
  const scheduler = createRpcScheduler({ now: () => time, sleep: async (ms) => { time += ms; } });
  const call = (error?: Error) => scheduler.run(async () => {
    starts.push(time);
    if (error) throw error;
    return starts.length;
  });
  return { scheduler, starts, call };
}

test("concurrent calls are paced without second-boundary bursts", async () => {
  const f = fixture();
  assert.deepEqual(await Promise.all([f.call(), f.call(), f.call(), f.call()]), [1, 2, 3, 4]);
  assert.deepEqual(f.starts, [0, 1000, 2000, 3000]);
});

test("429 applies shared exponential cooldown and propagates failure", async () => {
  const f = fixture();
  const error = Object.assign(new Error("rate limited"), { status: 429 });
  const result = await Promise.allSettled([f.call(error), f.call(error), f.call(), f.call()]);
  assert.deepEqual(result.map((r) => r.status), ["rejected", "rejected", "fulfilled", "fulfilled"]);
  assert.deepEqual(f.starts, [0, 5_000, 15_000, 16_000]);
  assert.equal(f.scheduler.stats.rateLimits, 2);
});

test("ordinary failures do not poison the queue or become empty results", async () => {
  const f = fixture();
  await assert.rejects(f.call(new Error("timeout")), /timeout/);
  assert.equal(await f.call(), 2);
  assert.deepEqual(f.starts, [0, 1000]);
});

test("recognizes nested viem throttling errors and handles circular causes", () => {
  assert.equal(isRpcRateLimit({ cause: { status: 429 } }), true);
  assert.equal(isRpcRateLimit({ code: -32005 }), true);
  const circular: { cause?: unknown } = {}; circular.cause = circular;
  assert.equal(isRpcRateLimit(circular), false);
  assert.equal(isRpcRateLimit(new Error("invalid params")), false);
});

test("unscoped log requests fail closed before reaching the public RPC", () => {
  for (const address of [undefined, [], "invalid", ["invalid"]]) {
    assert.throws(() => assertScopedLogRequest({ method: "eth_getLogs", params: [{ address }] }), /explicit contract addresses/);
  }
  assert.doesNotThrow(() => assertScopedLogRequest({ method: "eth_getLogs", params: [{ address: "0x1111111111111111111111111111111111111111" }] }));
  assert.doesNotThrow(() => assertScopedLogRequest({ method: "eth_blockNumber" }));
});

test("duplicate in-flight Registry requests share one RPC; later reads are fresh", async () => {
  const coalesce = createInflightCoalescer(); let calls = 0;
  const request = async () => ++calls;
  assert.deepEqual(await Promise.all([coalesce("registry-range", request), coalesce("registry-range", request)]), [1, 1]);
  assert.equal(await coalesce("registry-range", request), 2);
});

test("failed coalesced requests are evicted and remain failures", async () => {
  const coalesce = createInflightCoalescer();
  const fail = () => Promise.reject(new Error("RPC failed"));
  const results = await Promise.allSettled([coalesce("range", fail), coalesce("range", fail)]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(await coalesce("range", async () => "recovered"), "recovered");
});
