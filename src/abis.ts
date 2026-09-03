import { parseAbi } from "viem";

export const marketRegistryAbi = parseAbi([
  "event ContestRegistered(uint256 indexed chainId, bytes32 indexed contestId, address indexed marketVault, address creator, address sideAToken, address sideBToken, uint32 versionId, bytes32 metadataHash)",
]);

export const marketVaultAbi = parseAbi([
  "event Bought(bytes32 indexed contestId, address indexed trader, uint8 indexed side, uint256 grossInputUnits, uint256 feeUnits, uint256 tokenOutputWei, uint256 qAAfterWei, uint256 qBAfterWei, uint256 reserveAfterUnits)",
  "event Sold(bytes32 indexed contestId, address indexed trader, uint8 indexed side, uint256 tokenInputWei, uint256 grossOutputUnits, uint256 feeUnits, uint256 netOutputUnits, uint256 qAAfterWei, uint256 qBAfterWei, uint256 reserveAfterUnits, bool sellAll)",
  "event Flipped(bytes32 indexed contestId, address indexed trader, uint8 indexed sourceSide, uint256 sourceTokenInputWei, uint256 sourceGrossOutputUnits, uint256 feeUnits, uint256 destinationTokenOutputWei, uint256 qAAfterWei, uint256 qBAfterWei, uint256 reserveAfterUnits)",
  "event CrownActivated(bytes32 indexed contestId, uint256 qAWei, uint256 qBWei, uint256 reserveUnits)",
  "event CrownAssigned(bytes32 indexed contestId, uint8 indexed crownSide, uint256 qAWei, uint256 qBWei)",
  "event CrownTransferred(bytes32 indexed contestId, uint8 indexed previousCrownSide, uint8 indexed newCrownSide)",
]);

export const sideTokenAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const feeVaultAbi = parseAbi([
  "event TradingFeeAccrued(bytes32 indexed contestId, address indexed marketVault, address indexed creator, address referrer, uint256 feeUnits, uint256 protocolUnits, uint256 creatorUnits, uint256 referrerUnits, uint32 feeSplitVersion)",
  "event AccountFeesClaimed(address indexed account, address indexed caller, uint256 amountUnits)",
]);
