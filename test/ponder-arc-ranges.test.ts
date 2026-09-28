import assert from "node:assert/strict";
import { test } from "node:test";
import { numberToHex, pad, toEventSelector, zeroHash } from "viem";
import { isArcRangeMode, waitForNextArcRange } from "../node_modules/ponder/dist/esm/runtime/arc-ranges.js";
import { createHistoricalSync } from "../node_modules/ponder/dist/esm/sync-historical/index.js";
import { assertScopedLogRequest } from "../src/public-rpc";

process.env.PONDER_ARC_RANGE_MODE = "true";
const registry = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const transfer = toEventSelector("Transfer(address,address,uint256)");
const registered = toEventSelector("Registered(address)");
const factory = { id: "tokens", type: "log", chainId: 5042, address: registry, eventSelector: registered, childAddressLocation: "topic1" };
const filter = { type: "log", chainId: 5042, address: factory, topic0: transfer, hasTransactionReceipt: false };
const logger = { child: () => logger, trace() {}, debug() {}, info() {}, warn() {} };
const header = (n: number) => ({ number: numberToHex(n), hash: pad(numberToHex(n)), parentHash: pad(numberToHex(n - 1)), timestamp: numberToHex(n), logsBloom: `0x${"00".repeat(256)}`, transactions: [] });

test("range mode is explicit and limited to Arc mainnet", () => {
  assert.equal(isArcRangeMode({ id: 5042 }), true);
  assert.equal(isArcRangeMode({ id: 46630 }), false);
});

test("advancing 10,000 blocks only reads three boundary headers", async () => {
  const requests: any[] = [];
  const target = await waitForNextArcRange({
    common: { logger, shutdown: { isKilled: false } },
    chain: { pollingInterval: 5000, finalityBlockCount: 30 },
    previous: header(100), sleep: async () => {},
    rpc: { request: async (body: any) => {
      requests.push(body);
      return header(body.params[0] === "latest" ? 10130 : Number(body.params[0]));
    } },
  } as any);
  assert.equal(Number(target.number), 10100);
  assert.deepEqual(requests.map((r) => r.params), [["latest", false], ["0x64", false], [numberToHex(10100), false]]);
});

test("changed confirmed boundary fails instead of advancing", async () => {
  await assert.rejects(waitForNextArcRange({
    common: { logger, shutdown: { isKilled: false } }, chain: { pollingInterval: 5000, finalityBlockCount: 30 },
    previous: header(100), sleep: async () => {},
    rpc: { request: async (body: any) => body.params[0] === "latest" ? header(200) : { ...header(100), hash: pad("0xffff") } },
  } as any), /boundary changed/);
});

test("idle chain waits without scanning intermediate blocks", async () => {
  const requests: any[] = []; let polls = 0;
  await waitForNextArcRange({
    common: { logger, shutdown: { isKilled: false } }, chain: { pollingInterval: 5000, finalityBlockCount: 30 },
    previous: header(100), sleep: async () => { polls++; },
    rpc: { request: async (body: any) => {
      requests.push(body);
      return header(body.params[0] === "latest" ? (polls < 3 ? 130 : 160) : Number(body.params[0]));
    } },
  } as any);
  assert.equal(polls, 3);
  assert.equal(requests.length, 5);
});

function fixture() {
  const requests: any[] = [];
  const children = new Map([[factory.id, new Map<string, number>()]]);
  const sync = createHistoricalSync({
    chain: { id: 5042, name: "Arc", finalityBlockCount: 30 },
    common: { logger, options: { factoryAddressCountThreshold: 1 } },
    childAddresses: children,
    rpc: { request: async (body: any) => {
      requests.push(body); assertScopedLogRequest(body);
      if (body.method !== "eth_getLogs") throw new Error("Unexpected full-block scan");
      const f = body.params[0];
      const addresses = Array.isArray(f.address) ? f.address : [f.address];
      const log = (address: string, topics: string[], index: number) => ({ address, topics, blockNumber: "0x66", blockHash: pad("0x66"), transactionHash: zeroHash, transactionIndex: "0x0", logIndex: numberToHex(index), data: "0x", removed: false });
      if (addresses.includes(registry)) return [log(registry, [registered, pad(token)], 0)];
      if (addresses.includes(token)) return [log(token, [transfer], 1)];
      return [];
    } },
  } as any);
  return { sync, requests, children };
}

test("range discovers child first and retains its same-block Transfer", async () => {
  const f = fixture();
  const logs = await f.sync.syncBlockRangeData({
    interval: [101, 120], requiredIntervals: [{ filter, interval: [101, 120] }],
    requiredFactoryIntervals: [{ factory, interval: [101, 120] }],
    syncStore: { insertChildAddresses: async () => {} },
  } as any);
  assert.equal(f.children.get(factory.id)?.get(token), 102);
  assert.equal(logs[0]?.address, token);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].params[0].address, registry);
});

test("large factory sets remain address-filtered and are chunked", async () => {
  const f = fixture();
  for (let n = 1; n <= 120; n++) f.children.get(factory.id)!.set(pad(numberToHex(n), { size: 20 }), 90);
  await f.sync.syncBlockRangeData({ interval: [101, 120], requiredIntervals: [{ filter, interval: [101, 120] }], requiredFactoryIntervals: [], syncStore: {} } as any);
  assert.equal(f.requests.length, 3);
  assert.ok(f.requests.every((r) => Array.isArray(r.params[0].address) && r.params[0].address.length <= 50));
});

test("empty 100,000-block interval does not enumerate or fetch blocks", async () => {
  const f = fixture();
  const result = await f.sync.syncBlockData({ interval: [101, 100100], requiredIntervals: [{ filter, interval: [101, 100100] }], logs: [], syncStore: {} } as any);
  assert.equal(result, undefined);
  assert.equal(f.requests.length, 0);
});
