import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";

import { feeVaultAbi, marketRegistryAbi, marketVaultAbi, sideTokenAbi } from "./src/abis";
import { resolveIndexerEnvironment } from "./src/environment";
import { officialPublicRpc } from "./src/public-rpc";

const { chainId, rpcUrl, registry, feeVault, startBlock: deploymentStartBlock } = resolveIndexerEnvironment();

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: chainId,
      // Smooth requests instead of bursting at each wall-clock second.
      rpc: chainId === 5042 ? officialPublicRpc(rpcUrl) : rpcUrl,
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
