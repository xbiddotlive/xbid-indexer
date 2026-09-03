import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";

import { feeVaultAbi, marketRegistryAbi, marketVaultAbi } from "./src/abis";

const registry = "0x0B68fD82965Fd853907CA4E2f7E6E6d478Aaef8b";
const feeVault = "0x82D9159cB488175cAcdcD145A7285d80563e69d0";
const deploymentStartBlock = 111_163_164;

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: 46_630,
      rpc:
        process.env.PONDER_RPC_URL_46630 ??
        "https://rpc.testnet.chain.robinhood.com",
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
  },
});
