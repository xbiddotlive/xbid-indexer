import { index, onchainTable, primaryKey } from "ponder";

export const contests = onchainTable(
  "contests",
  (t) => ({
    chainId: t.bigint().notNull(),
    contestId: t.hex().notNull(),
    marketVault: t.hex().notNull(),
    creator: t.hex().notNull(),
    sideAToken: t.hex().notNull(),
    sideBToken: t.hex().notNull(),
    marketVersion: t.integer().notNull(),
    metadataHash: t.hex().notNull(),
    createdBlock: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.contestId] }),
    marketVaultIndex: index().on(table.marketVault),
  }),
);

export const marketStates = onchainTable("market_states", (t) => ({
  marketVault: t.hex().primaryKey(),
  contestId: t.hex().notNull(),
  qAWei: t.bigint().notNull(),
  qBWei: t.bigint().notNull(),
  reserveUnits: t.bigint().notNull(),
  cumulativeVolumeUnits: t.bigint().notNull(),
  cumulativeFeeUnits: t.bigint().notNull(),
  tradeCount: t.bigint().notNull(),
  publicCumulativeVolumeUnits: t.bigint().notNull().default(0n),
  publicCumulativeFeeUnits: t.bigint().notNull().default(0n),
  publicTradeCount: t.bigint().notNull().default(0n),
  crownSide: t.integer(),
  crownActivated: t.boolean().notNull(),
  updatedBlock: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}));

export const trades = onchainTable(
  "trades",
  (t) => ({
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    marketVault: t.hex().notNull(),
    contestId: t.hex().notNull(),
    trader: t.hex().notNull(),
    kind: t.text().notNull(),
    side: t.integer().notNull(),
    inputWei: t.bigint().notNull(),
    grossUnits: t.bigint().notNull(),
    feeUnits: t.bigint().notNull(),
    outputWei: t.bigint().notNull(),
    qAAfterWei: t.bigint().notNull(),
    qBAfterWei: t.bigint().notNull(),
    reserveAfterUnits: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.transactionHash, table.logIndex] }),
    contestTimeIndex: index().on(table.contestId, table.blockNumber),
    traderIndex: index().on(table.trader, table.blockNumber),
    blockIndex: index().on(table.blockNumber, table.logIndex),
    marketTimeIndex: index().on(table.marketVault, table.blockTimestamp),
    contestMarketOrderIndex: index().on(table.contestId, table.marketVault, table.blockNumber, table.logIndex),
    marketTraderOrderIndex: index().on(table.marketVault, table.trader, table.blockNumber, table.logIndex),
  }),
);

export const feeAccruals = onchainTable(
  "fee_accruals",
  (t) => ({
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    contestId: t.hex().notNull(),
    marketVault: t.hex().notNull(),
    creator: t.hex().notNull(),
    referrer: t.hex().notNull(),
    feeUnits: t.bigint().notNull(),
    protocolUnits: t.bigint().notNull(),
    creatorUnits: t.bigint().notNull(),
    referrerUnits: t.bigint().notNull(),
    splitVersion: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.transactionHash, table.logIndex] }),
    creatorIndex: index().on(table.creator, table.blockNumber),
    referrerIndex: index().on(table.referrer, table.blockNumber),
    contestIndex: index().on(table.contestId, table.blockNumber),
  }),
);

export const feeClaims = onchainTable(
  "fee_claims",
  (t) => ({
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    account: t.hex().notNull(),
    caller: t.hex().notNull(),
    amountUnits: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.transactionHash, table.logIndex] }),
    accountIndex: index().on(table.account, table.blockNumber),
  }),
);

export const crownEvents = onchainTable(
  "crown_events",
  (t) => ({
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    contestId: t.hex().notNull(),
    marketVault: t.hex().notNull(),
    kind: t.text().notNull(),
    side: t.integer(),
    previousSide: t.integer(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.transactionHash, table.logIndex] }),
    contestIndex: index().on(table.contestId, table.blockNumber),
  }),
);

export const sideTokenBalances = onchainTable(
  "side_token_balances",
  (t) => ({
    token: t.hex().notNull(),
    account: t.hex().notNull(),
    balanceWei: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.token, table.account] }),
    accountBalanceIndex: index().on(table.account, table.balanceWei),
  }),
);

export const traderMarketCosts = onchainTable(
  "trader_market_costs",
  (t) => ({
    trader: t.hex().notNull(),
    marketVault: t.hex().notNull(),
    qAWei: t.bigint().notNull(),
    qBWei: t.bigint().notNull(),
    costAUnits: t.bigint().notNull(),
    costBUnits: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.trader, table.marketVault] }),
  }),
);

export const traderPerformance = onchainTable(
  "trader_performance",
  (t) => ({
    trader: t.hex().primaryKey(),
    realizedCostUnits: t.bigint().notNull(),
    realizedPnlUnits: t.bigint().notNull(),
    volumeUnits: t.bigint().notNull(),
    tradeCount: t.bigint().notNull(),
    winningSales: t.bigint().notNull(),
    sales: t.bigint().notNull(),
    currentStreak: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    rankingIndex: index().on(table.realizedPnlUnits, table.updatedBlock),
  }),
);
