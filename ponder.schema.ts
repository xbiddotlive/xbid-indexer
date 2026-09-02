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
  }),
);
