import assert from "node:assert/strict";
import test from "node:test";

import { resolveIndexerEnvironment } from "../src/environment";

const baseSepolia = {
  XBID_ENVIRONMENT: "testnet", PONDER_CHAIN_ID: "84532", PONDER_RPC_URL: "https://sepolia.base.org",
  PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
  PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
  PONDER_START_BLOCK: "100", PUBLIC_METRICS_START_BLOCK: "100",
};

test("Arc indexer rejects mixed networks and missing replay boundaries", () => {
  const arc = { ...baseSepolia, XBID_ENVIRONMENT: "mainnet", PONDER_CHAIN_ID: "5042", PONDER_RPC_URL: "https://rpc.mainnet.arc.io" };
  assert.equal(resolveIndexerEnvironment(arc).chainId, 5042);
  assert.equal(resolveIndexerEnvironment({ ...arc, XBID_ENVIRONMENT: "testnet", PONDER_CHAIN_ID: "5042002", PONDER_RPC_URL: "https://rpc.testnet.arc.io" }).chainId, 5042002);
  assert.throws(() => resolveIndexerEnvironment({ ...arc, PONDER_CHAIN_ID: "5042002" }), /Arc chain ID/);
  assert.throws(() => resolveIndexerEnvironment({ ...arc, XBID_ENVIRONMENT: "testnet" }), /Arc chain ID/);
  assert.throws(() => resolveIndexerEnvironment({ ...arc, PONDER_RPC_URL: "https://rpc.testnet.arc.io./" }), /Arc endpoint/);
  assert.throws(() => resolveIndexerEnvironment({ ...arc, PONDER_START_BLOCK: undefined }), /explicitly set/);
  assert.throws(() => resolveIndexerEnvironment({ ...arc, PONDER_REGISTRY_ADDRESS: undefined }), /explicitly set/);
});

test("Base Sepolia indexer requires an explicit, isolated deployment", () => {
  assert.equal(resolveIndexerEnvironment(baseSepolia).chainId, 84532);
  for (const key of ["PONDER_RPC_URL", "PONDER_REGISTRY_ADDRESS", "PONDER_FEE_VAULT_ADDRESS", "PONDER_START_BLOCK", "PUBLIC_METRICS_START_BLOCK"]) {
    assert.throws(() => resolveIndexerEnvironment({ ...baseSepolia, [key]: undefined }), /explicitly set/);
  }
  assert.throws(() => resolveIndexerEnvironment({ ...baseSepolia, PONDER_REGISTRY_ADDRESS: "0x0B68fD82965Fd853907CA4E2f7E6E6d478Aaef8b" }), /own non-zero/);
  assert.throws(() => resolveIndexerEnvironment({ ...baseSepolia, PONDER_RPC_URL: "https://rpc.testnet.chain.robinhood.com./" }), /Robinhood RPC/);
  assert.throws(() => resolveIndexerEnvironment({ ...baseSepolia, PUBLIC_METRICS_START_BLOCK: "99" }), /cannot precede/);
  assert.throws(() => resolveIndexerEnvironment({ ...baseSepolia, PONDER_CHAIN_ID: "8453" }), /Base chain ID/);
});

test("mainnet indexer rejects testnet URL variants and insecure transports", () => {
  const mainnet = {
    XBID_ENVIRONMENT: "mainnet", PONDER_CHAIN_ID: "4663",
    PONDER_RPC_URL: "https://rpc.mainnet.example",
    PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
    PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
    PONDER_START_BLOCK: "1", PUBLIC_METRICS_START_BLOCK: "2",
  };
  for (const rpc of ["https://rpc.testnet.chain.robinhood.com/", "https://RPC.TESTNET.CHAIN.ROBINHOOD.COM:443/path", "https://rpc.testnet.chain.robinhood.com./"]) {
    assert.throws(() => resolveIndexerEnvironment({ ...mainnet, PONDER_RPC_URL: rpc }), /Robinhood Testnet value/);
  }
  for (const rpc of ["http://mainnet.example", "file:///tmp/rpc"]) {
    assert.throws(() => resolveIndexerEnvironment({ ...mainnet, PONDER_RPC_URL: rpc }), /requires HTTPS/);
  }
});

test("testnet indexer retains the known development defaults", () => {
  const config = resolveIndexerEnvironment({});
  assert.equal(config.environment, "testnet");
  assert.equal(config.chainId, 46630);
  assert.equal(config.publicMetricsStartBlock, 0);
});

test("mainnet indexer cannot inherit testnet defaults", () => {
  assert.throws(
    () => resolveIndexerEnvironment({ XBID_ENVIRONMENT: "mainnet" }),
    /mainnet indexer must explicitly set/,
  );
});

test("mainnet indexer rejects copied testnet values", () => {
  assert.throws(
    () => resolveIndexerEnvironment({
      XBID_ENVIRONMENT: "mainnet",
      PONDER_CHAIN_ID: "46630",
      PONDER_RPC_URL: "https://rpc.mainnet.example",
      PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
      PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
      PONDER_START_BLOCK: "1",
      LEADERBOARD_START_BLOCK: "2",
    }),
    /cannot use the Robinhood Testnet value for chainId/,
  );
});

test("explicit non-testnet indexer values are accepted", () => {
  const config = resolveIndexerEnvironment({
    XBID_ENVIRONMENT: "mainnet",
    PONDER_CHAIN_ID: "99999",
    PONDER_RPC_URL: "https://rpc.mainnet.example",
    PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
    PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
    PONDER_START_BLOCK: "1",
    LEADERBOARD_START_BLOCK: "2",
  });
  assert.equal(config.environment, "mainnet");
  assert.equal(config.chainId, 99999);
  assert.equal(config.publicMetricsStartBlock, 2);
});

test("mainnet indexer requires an explicit public metrics boundary", () => {
  assert.throws(
    () => resolveIndexerEnvironment({
      XBID_ENVIRONMENT: "mainnet",
      PONDER_CHAIN_ID: "99999",
      PONDER_RPC_URL: "https://rpc.mainnet.example",
      PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
      PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
      PONDER_START_BLOCK: "1",
    }),
    /PUBLIC_METRICS_START_BLOCK or LEADERBOARD_START_BLOCK/,
  );
});

test("mainnet public metrics cannot begin before contract indexing", () => {
  assert.throws(
    () => resolveIndexerEnvironment({
      XBID_ENVIRONMENT: "mainnet",
      PONDER_CHAIN_ID: "99999",
      PONDER_RPC_URL: "https://rpc.mainnet.example",
      PONDER_REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111",
      PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
      PONDER_START_BLOCK: "10",
      PUBLIC_METRICS_START_BLOCK: "9",
    }),
    /cannot precede PONDER_START_BLOCK/,
  );
});

test("mainnet indexer rejects zero contract addresses", () => {
  assert.throws(
    () => resolveIndexerEnvironment({
      XBID_ENVIRONMENT: "mainnet",
      PONDER_CHAIN_ID: "99999",
      PONDER_RPC_URL: "https://rpc.mainnet.example",
      PONDER_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000000",
      PONDER_FEE_VAULT_ADDRESS: "0x2222222222222222222222222222222222222222",
      PONDER_START_BLOCK: "1",
      PUBLIC_METRICS_START_BLOCK: "2",
    }),
    /zero address for PONDER_REGISTRY_ADDRESS/,
  );
});
