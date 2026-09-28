import { createConfig, factory, rateLimit } from "ponder";
import { http, parseAbiItem } from "viem";

import { feeVaultAbi, marketRegistryAbi, marketVaultAbi, sideTokenAbi } from "./src/abis";
import { resolveIndexerEnvironment } from "./src/environment";

const { chainId, rpcUrl, registry, feeVault, startBlock: deploymentStartBlock } = resolveIndexerEnvironment();

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: chainId,
      // Arc's public endpoint needs a hard cap; Ponder's deprecated
      // maxRequestsPerSecond setting no longer limits requests.
      rpc: chainId === 5042
        ? rateLimit(http(rpcUrl), { requestsPerSecond: 8, browser: false })
        : rpcUrl,
      pollingInterval: chainId === 5042 ? 5_000 : 1_000,
    },
  },
  contracts: {
    FeeVault: {
      abi: feeVaultAbi,
      chain: "robinhoodTestnet",
      address: feeVault,
      startBlock: deploymentStartBlock,
    },
    MarketRegistry: {
      abi: marketRegistryAbi,
      chain: "robinhoodTestnet",
      address: registry,
      startBlock: deploymentStartBlock,
    },
    MarketVault: {
      abi: marketVaultAbi,
      chain: "robinhoodTestnet",
      address: factory({
        address: registry,
        event: parseAbiItem(
          "event ContestRegistered(uint256 indexed chainId, bytes32 indexed contestId, address indexed marketVault, address creator, address sideAToken, address sideBToken, uint32 versionId, bytes32 metadataHash)",
        ),
        parameter: "marketVault",
      }),
      startBlock: deploymentStartBlock,
      includeTransactionReceipts: true,
    },
    SideAToken: {
      abi: sideTokenAbi,
      chain: "robinhoodTestnet",
      address: factory({
        address: registry,
        event: parseAbiItem(
          "event ContestRegistered(uint256 indexed chainId, bytes32 indexed contestId, address indexed marketVault, address creator, address sideAToken, address sideBToken, uint32 versionId, bytes32 metadataHash)",
        ),
        parameter: "sideAToken",
      }),
      startBlock: deploymentStartBlock,
    },
    SideBToken: {
      abi: sideTokenAbi,
      chain: "robinhoodTestnet",
      address: factory({
        address: registry,
        event: parseAbiItem(
          "event ContestRegistered(uint256 indexed chainId, bytes32 indexed contestId, address indexed marketVault, address creator, address sideAToken, address sideBToken, uint32 versionId, bytes32 metadataHash)",
        ),
        parameter: "sideBToken",
      }),
      startBlock: deploymentStartBlock,
    },
  },
});
