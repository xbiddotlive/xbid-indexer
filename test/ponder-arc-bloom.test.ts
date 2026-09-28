import assert from "node:assert/strict";
import { test } from "node:test";
import { hexToBytes, keccak256, numberToHex, pad, toEventSelector, zeroHash } from "viem";
// Test the actual pinned runtime, not a copy of the patch's logic.
import { isFilterInBloom } from "../node_modules/ponder/dist/esm/sync-realtime/bloom.js";
import { createRealtimeSync } from "../node_modules/ponder/dist/esm/sync-realtime/index.js";

const registry = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const unrelated = "0x3333333333333333333333333333333333333333";
const transfer = toEventSelector("Transfer(address,address,uint256)");
const registered = toEventSelector("Registered(address)");
const factory = { id: "tokens", type: "log", chainId: 5042, address: registry, eventSelector: registered, childAddressLocation: "topic1" };
const filter = { type: "log", chainId: 5042, address: factory, topic0: transfer, hasTransactionReceipt: false };

function bloom(values: string[]) {
  const bytes = new Uint8Array(256);
  for (const value of values) {
    const hash = hexToBytes(keccak256(value as `0x${string}`));
    for (const i of [0, 2, 4]) {
      const bit = (hash[i + 1]! + (hash[i]! << 8)) & 2047;
      bytes[255 - Math.floor(bit / 8)]! |= 1 << (bit % 8);
    }
  }
  return `0x${Buffer.from(bytes).toString("hex")}` as const;
}

function fixture() {
  const blocks = new Map<string, any>();
  const logs = new Map<string, any[]>();
  const requests: { method: string; params: any[] }[] = [];
  const children = new Map([[factory.id, new Map<string, number>()]]);
  const warnings: any[] = [];
  const logger = { child: () => logger, trace() {}, debug() {}, warn: (v: any) => warnings.push(v) };
  function block(n: number, entries: { address: string; topics: string[] }[] = [{ address: unrelated, topics: [transfer] }], hash = pad(numberToHex(n)), parentHash = pad(numberToHex(n - 1))) {
    const result = { number: numberToHex(n), hash, parentHash, timestamp: numberToHex(n), transactions: [], logsBloom: bloom(entries.flatMap((e) => [e.address, ...e.topics])) };
    blocks.set(result.number, result); blocks.set(hash, result);
    logs.set(hash, entries.map((entry, i) => ({ ...entry, blockHash: hash, blockNumber: result.number, transactionHash: zeroHash, transactionIndex: "0x0", logIndex: numberToHex(i), data: "0x", removed: false })));
    return result;
  }
  const sync = createRealtimeSync({
    common: { logger, shutdown: { isKilled: false } },
    chain: { id: 5042, name: "Arc", pollingInterval: 5000, finalityBlockCount: 30 },
    rpc: { async request(body: { method: string; params: any[] }) {
      requests.push(body);
      if (body.method === "eth_getLogs") return structuredClone(logs.get(body.params[0].blockHash));
      if (body.method === "eth_getBlockByNumber" || body.method === "eth_getBlockByHash") return structuredClone(blocks.get(body.params[0]));
      throw new Error(`Unexpected RPC ${body.method}`);
    } },
    eventCallbacks: [{ filter }],
    syncProgress: { finalized: block(100) }, childAddresses: children,
  } as any);
  const run = async (b: any) => {
    const events = [];
    for await (const event of sync.sync(structuredClone(b))) events.push(event);
    const failures = warnings.filter((v) => v.msg === "Failed to fetch latest block");
    assert.deepEqual(failures, [], JSON.stringify(failures));
    return events;
  };
  return { block, run, requests, children };
}

test("factory bloom skips unrelated Transfers only with complete child coverage", () => {
  const block = { number: "0x65", logsBloom: bloom([unrelated, transfer]) };
  assert.equal(isFilterInBloom({ block, filter } as any), true);
  assert.equal(isFilterInBloom({ block, filter, childAddresses: new Map() } as any), true);
  assert.equal(isFilterInBloom({ block, filter, childAddresses: new Map([[factory.id, new Map()]]) } as any), false);
  assert.equal(isFilterInBloom({ block, filter, childAddresses: new Map([[factory.id, new Map([[unrelated, 99]])]]) } as any), true);
});

test("same-block registration and Transfer are not lost", async () => {
  const f = fixture();
  const events = await f.run(f.block(101, [
    { address: registry, topics: [registered, pad(token)] },
    { address: token, topics: [transfer] },
  ]));
  assert.equal(f.children.get(factory.id)?.get(token), 101);
  assert.equal(events[0]?.logs[0]?.address, token);
});

test("gap batch reconciles registration before the next block's Transfer", async () => {
  const f = fixture();
  f.block(101); // unrelated: no getLogs necessary
  f.block(102, [{ address: registry, topics: [registered, pad(token)] }]);
  f.block(103, [{ address: token, topics: [transfer] }]);
  const events = await f.run(f.block(104)); // speculative head must fail open
  assert.deepEqual(events.filter((e) => e.type === "block").map((e) => Number(e.block.number)), [101, 102, 103, 104]);
  assert.equal(events.find((e) => Number(e.block.number) === 103)?.logs[0]?.address, token);
  const queried = f.requests.filter((r) => r.method === "eth_getLogs").map((r) => r.params[0].blockHash);
  assert.equal(queried.includes(pad(numberToHex(101))), false);
  assert.equal(queried.includes(pad(numberToHex(104))), true);
});

test("known child Transfer is retained after historical discovery", async () => {
  const f = fixture(); f.children.get(factory.id)!.set(token, 90);
  const events = await f.run(f.block(101, [{ address: token, topics: [transfer] }]));
  assert.equal(events[0]?.logs[0]?.address, token);
});

test("reorg rolls back child discovery and replacement block is processed", async () => {
  const f = fixture();
  await f.run(f.block(101, [{ address: registry, topics: [registered, pad(token)] }]));
  const replacement = f.block(101, undefined, pad("0xabcd"));
  const reorg = await f.run(replacement);
  assert.equal(reorg[0]?.type, "reorg");
  assert.equal(f.children.get(factory.id)?.has(token), false);
  // A subsequent different head fills the replacement block as a gap.
  const events = await f.run(f.block(102, undefined, pad("0xabce"), replacement.hash));
  assert.deepEqual(events.filter((e) => e.type === "block").map((e) => Number(e.block.number)), [101, 102]);
});

test("empty bloom keeps Ponder's conservative RPC verification", async () => {
  const f = fixture();
  await f.run(f.block(101, []));
  assert.equal(f.requests.some((r) => r.method === "eth_getLogs"), true);
});
