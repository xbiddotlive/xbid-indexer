import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";

import { feeVaultAbi, marketRegistryAbi, marketVaultAbi, sideTokenAbi } from "./src/abis";
import { resolveIndexerEnvironment } from "./src/environment";

const { chainId, rpcUrl, registry, feeVault, startBlock: deploymentStartBlock } = resolveIndexerEnvironment();

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: chainId,
      rpc: rpcUrl,
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
