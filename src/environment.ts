const TESTNET = Object.freeze({
  chainId: 46_630,
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  registry: "0x0B68fD82965Fd853907CA4E2f7E6E6d478Aaef8b",
  feeVault: "0x82D9159cB488175cAcdcD145A7285d80563e69d0",
  startBlock: 111_163_164,
});

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const zeroAddress = "0x0000000000000000000000000000000000000000";

export function resolveIndexerEnvironment(input: NodeJS.ProcessEnv = process.env) {
  const environment = input.XBID_ENVIRONMENT ?? "testnet";
  if (environment !== "testnet" && environment !== "mainnet") {
    throw new Error("XBID_ENVIRONMENT must be either testnet or mainnet.");
  }
  if (environment === "mainnet") {
    const required = [
      "PONDER_CHAIN_ID",
      "PONDER_RPC_URL",
      "PONDER_REGISTRY_ADDRESS",
      "PONDER_FEE_VAULT_ADDRESS",
      "PONDER_START_BLOCK",
    ] as const;
    const missing = required.filter((key) => !input[key]);
    if (missing.length > 0) throw new Error(`mainnet indexer must explicitly set: ${missing.join(", ")}`);
    if (!input.PUBLIC_METRICS_START_BLOCK && !input.LEADERBOARD_START_BLOCK) {
      throw new Error("mainnet indexer must explicitly set PUBLIC_METRICS_START_BLOCK or LEADERBOARD_START_BLOCK");
    }
  }

  const chainId = Number(input.PONDER_CHAIN_ID ?? TESTNET.chainId);
  const rpcUrl = input.PONDER_RPC_URL
    ?? input.PONDER_RPC_URL_46630
    ?? TESTNET.rpcUrl;
  const registry = input.PONDER_REGISTRY_ADDRESS ?? TESTNET.registry;
  const feeVault = input.PONDER_FEE_VAULT_ADDRESS ?? TESTNET.feeVault;
  const startBlock = Number(input.PONDER_START_BLOCK ?? TESTNET.startBlock);
  const publicMetricsStartBlock = Number(input.PUBLIC_METRICS_START_BLOCK ?? input.LEADERBOARD_START_BLOCK ?? 0);

  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("PONDER_CHAIN_ID must be a positive safe integer.");
  if (!Number.isSafeInteger(startBlock) || startBlock < 0) throw new Error("PONDER_START_BLOCK must be a non-negative safe integer.");
  if (!Number.isSafeInteger(publicMetricsStartBlock) || publicMetricsStartBlock < 0) {
    throw new Error("PUBLIC_METRICS_START_BLOCK must be a non-negative safe integer.");
  }
  if (environment === "mainnet" && publicMetricsStartBlock < startBlock) {
    throw new Error("PUBLIC_METRICS_START_BLOCK cannot precede PONDER_START_BLOCK on mainnet.");
  }
  if (!URL.canParse(rpcUrl)) throw new Error("PONDER_RPC_URL must be a valid URL.");
  const rpc = new URL(rpcUrl);
  if (environment === "mainnet" && rpc.protocol !== "https:") {
    throw new Error("mainnet indexer requires HTTPS for PONDER_RPC_URL");
  }
  if (!addressPattern.test(registry)) throw new Error("PONDER_REGISTRY_ADDRESS must be an EVM address.");
  if (!addressPattern.test(feeVault)) throw new Error("PONDER_FEE_VAULT_ADDRESS must be an EVM address.");
  if (environment === "mainnet" && registry.toLowerCase() === zeroAddress) {
    throw new Error("mainnet indexer cannot use the zero address for PONDER_REGISTRY_ADDRESS");
  }
  if (environment === "mainnet" && feeVault.toLowerCase() === zeroAddress) {
    throw new Error("mainnet indexer cannot use the zero address for PONDER_FEE_VAULT_ADDRESS");
  }

  if (environment === "mainnet") {
    const values = { chainId, rpcUrl, registry, feeVault, startBlock };
    for (const [key, testnetValue] of Object.entries(TESTNET)) {
      const matchesTestnet = key === "rpcUrl"
        ? rpc.hostname.replace(/\.$/, "") === new URL(TESTNET.rpcUrl).hostname
        : String(values[key as keyof typeof values]).toLowerCase() === String(testnetValue).toLowerCase();
      if (matchesTestnet) {
        throw new Error(`mainnet indexer cannot use the Robinhood Testnet value for ${key}`);
      }
    }
  }

  return {
    environment,
    chainId,
    rpcUrl,
    registry: registry as `0x${string}`,
    feeVault: feeVault as `0x${string}`,
    startBlock,
    publicMetricsStartBlock,
  } as const;
}
