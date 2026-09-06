import assert from "node:assert/strict";
import test from "node:test";

import { resolveIndexerEnvironment } from "../src/environment";

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
