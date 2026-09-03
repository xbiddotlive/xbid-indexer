import { ponder } from "ponder:registry";
import { contests, crownEvents, feeAccruals, feeClaims, marketStates, sideTokenBalances, traderMarketCosts, traderPerformance, trades } from "ponder:schema";
import { applyPerformanceTrade } from "./trader-performance";

const publicMetricsStartBlock = BigInt(process.env.PUBLIC_METRICS_START_BLOCK ?? process.env.LEADERBOARD_START_BLOCK ?? "0");
const zeroAddress = "0x0000000000000000000000000000000000000000";

async function updateTokenBalance(
  db: Parameters<Parameters<typeof ponder.on>[1]>[0]["context"]["db"],
  token: `0x${string}`,
  account: `0x${string}`,
  delta: bigint,
  blockNumber: bigint,
) {
  if (account.toLowerCase() === zeroAddress) return;
  await db.insert(sideTokenBalances).values({
    token,
    account,
    balanceWei: delta,
    updatedBlock: blockNumber,
  }).onConflictDoUpdate((row) => ({
    balanceWei: row.balanceWei + delta,
    updatedBlock: blockNumber,
  }));
}

async function recordTransfer(event: {
  args: { from: `0x${string}`; to: `0x${string}`; value: bigint };
  block: { number: bigint };
  log: { address: `0x${string}` };
}, db: Parameters<Parameters<typeof ponder.on>[1]>[0]["context"]["db"]) {
  await updateTokenBalance(db, event.log.address, event.args.from, -event.args.value, event.block.number);
  await updateTokenBalance(db, event.log.address, event.args.to, event.args.value, event.block.number);
}

ponder.on("SideAToken:Transfer", async ({ event, context }) => recordTransfer(event, context.db));
ponder.on("SideBToken:Transfer", async ({ event, context }) => recordTransfer(event, context.db));

type TradeKind = "BUY" | "FLIP" | "SELL";

async function updateTraderPerformance(
  db: Parameters<Parameters<typeof ponder.on>[1]>[0]["context"]["db"],
  input: {
    blockNumber: bigint;
    grossUnits: bigint;
    inputWei: bigint;
    kind: TradeKind;
    marketVault: `0x${string}`;
    outputWei: bigint;
    side: number;
    trader: `0x${string}`;
  },
) {
  if (input.blockNumber < publicMetricsStartBlock) return;
  const existing = await db.find(traderMarketCosts, { trader: input.trader, marketVault: input.marketVault });
  const state = existing ?? {
    trader: input.trader,
    marketVault: input.marketVault,
    qAWei: 0n,
    qBWei: 0n,
    costAUnits: 0n,
    costBUnits: 0n,
    updatedBlock: input.blockNumber,
  };
  const next = applyPerformanceTrade(state, input);
  const { costAUnits, costBUnits, qAWei, qBWei, realizedCostUnits, realizedPnlUnits, sale } = next;

  await db.insert(traderMarketCosts).values({
    trader: input.trader,
    marketVault: input.marketVault,
    qAWei,
    qBWei,
    costAUnits,
    costBUnits,
    updatedBlock: input.blockNumber,
  }).onConflictDoUpdate({ qAWei, qBWei, costAUnits, costBUnits, updatedBlock: input.blockNumber });

  await db.insert(traderPerformance).values({
    trader: input.trader,
    realizedCostUnits,
    realizedPnlUnits,
    volumeUnits: input.grossUnits,
    tradeCount: 1n,
    winningSales: sale && realizedPnlUnits > 0n ? 1n : 0n,
    sales: sale ? 1n : 0n,
    currentStreak: sale && realizedPnlUnits > 0n ? 1n : 0n,
    updatedBlock: input.blockNumber,
  }).onConflictDoUpdate((row) => ({
    realizedCostUnits: row.realizedCostUnits + realizedCostUnits,
    realizedPnlUnits: row.realizedPnlUnits + realizedPnlUnits,
    volumeUnits: row.volumeUnits + input.grossUnits,
    tradeCount: row.tradeCount + 1n,
    winningSales: row.winningSales + (sale && realizedPnlUnits > 0n ? 1n : 0n),
    sales: row.sales + (sale ? 1n : 0n),
    currentStreak: sale ? (realizedPnlUnits > 0n ? row.currentStreak + 1n : 0n) : row.currentStreak,
    updatedBlock: input.blockNumber,
  }));
}

ponder.on("FeeVault:TradingFeeAccrued", async ({ event, context }) => {
  await context.db.insert(feeAccruals).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    contestId: event.args.contestId,
    marketVault: event.args.marketVault,
    creator: event.args.creator,
    referrer: event.args.referrer,
    feeUnits: event.args.feeUnits,
    protocolUnits: event.args.protocolUnits,
    creatorUnits: event.args.creatorUnits,
    referrerUnits: event.args.referrerUnits,
    splitVersion: event.args.feeSplitVersion,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
});

ponder.on("FeeVault:AccountFeesClaimed", async ({ event, context }) => {
  await context.db.insert(feeClaims).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    account: event.args.account,
    caller: event.args.caller,
    amountUnits: event.args.amountUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
});

ponder.on("MarketRegistry:ContestRegistered", async ({ event, context }) => {
  await context.db
    .insert(contests)
    .values({
      chainId: event.args.chainId,
      contestId: event.args.contestId,
      marketVault: event.args.marketVault,
      creator: event.args.creator,
      sideAToken: event.args.sideAToken,
      sideBToken: event.args.sideBToken,
      marketVersion: event.args.versionId,
      metadataHash: event.args.metadataHash,
      createdBlock: event.block.number,
      createdAt: event.block.timestamp,
      transactionHash: event.transaction.hash,
    })
    .onConflictDoNothing();

  await context.db
    .insert(marketStates)
    .values({
      marketVault: event.args.marketVault,
      contestId: event.args.contestId,
      qAWei: 0n,
      qBWei: 0n,
      reserveUnits: 0n,
      cumulativeVolumeUnits: 0n,
      cumulativeFeeUnits: 0n,
      tradeCount: 0n,
      publicCumulativeVolumeUnits: 0n,
      publicCumulativeFeeUnits: 0n,
      publicTradeCount: 0n,
      crownSide: null,
      crownActivated: false,
      updatedBlock: event.block.number,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoNothing();
});

ponder.on("MarketVault:Bought", async ({ event, context }) => {
  await context.db.insert(trades).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    marketVault: event.log.address,
    contestId: event.args.contestId,
    trader: event.args.trader,
    kind: "BUY",
    side: event.args.side,
    inputWei: event.args.grossInputUnits,
    grossUnits: event.args.grossInputUnits,
    feeUnits: event.args.feeUnits,
    outputWei: event.args.tokenOutputWei,
    qAAfterWei: event.args.qAAfterWei,
    qBAfterWei: event.args.qBAfterWei,
    reserveAfterUnits: event.args.reserveAfterUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateMarket(context.db, event.log.address, {
    qAWei: event.args.qAAfterWei,
    qBWei: event.args.qBAfterWei,
    reserveUnits: event.args.reserveAfterUnits,
    volumeUnits: event.args.grossInputUnits,
    feeUnits: event.args.feeUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateTraderPerformance(context.db, {
    blockNumber: event.block.number,
    grossUnits: event.args.grossInputUnits,
    inputWei: event.args.grossInputUnits,
    kind: "BUY",
    marketVault: event.log.address,
    outputWei: event.args.tokenOutputWei,
    side: event.args.side,
    trader: event.args.trader,
  });
});

ponder.on("MarketVault:Sold", async ({ event, context }) => {
  await context.db.insert(trades).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    marketVault: event.log.address,
    contestId: event.args.contestId,
    trader: event.args.trader,
    kind: event.args.sellAll ? "SELL_ALL" : "SELL",
    side: event.args.side,
    inputWei: event.args.tokenInputWei,
    grossUnits: event.args.grossOutputUnits,
    feeUnits: event.args.feeUnits,
    outputWei: event.args.netOutputUnits,
    qAAfterWei: event.args.qAAfterWei,
    qBAfterWei: event.args.qBAfterWei,
    reserveAfterUnits: event.args.reserveAfterUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateMarket(context.db, event.log.address, {
    qAWei: event.args.qAAfterWei,
    qBWei: event.args.qBAfterWei,
    reserveUnits: event.args.reserveAfterUnits,
    volumeUnits: event.args.grossOutputUnits,
    feeUnits: event.args.feeUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateTraderPerformance(context.db, {
    blockNumber: event.block.number,
    grossUnits: event.args.grossOutputUnits,
    inputWei: event.args.tokenInputWei,
    kind: "SELL",
    marketVault: event.log.address,
    outputWei: event.args.netOutputUnits,
    side: event.args.side,
    trader: event.args.trader,
  });
});

ponder.on("MarketVault:Flipped", async ({ event, context }) => {
  await context.db.insert(trades).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    marketVault: event.log.address,
    contestId: event.args.contestId,
    trader: event.args.trader,
    kind: "FLIP",
    side: event.args.sourceSide,
    inputWei: event.args.sourceTokenInputWei,
    grossUnits: event.args.sourceGrossOutputUnits,
    feeUnits: event.args.feeUnits,
    outputWei: event.args.destinationTokenOutputWei,
    qAAfterWei: event.args.qAAfterWei,
    qBAfterWei: event.args.qBAfterWei,
    reserveAfterUnits: event.args.reserveAfterUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateMarket(context.db, event.log.address, {
    qAWei: event.args.qAAfterWei,
    qBWei: event.args.qBAfterWei,
    reserveUnits: event.args.reserveAfterUnits,
    volumeUnits: event.args.sourceGrossOutputUnits,
    feeUnits: event.args.feeUnits,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await updateTraderPerformance(context.db, {
    blockNumber: event.block.number,
    grossUnits: event.args.sourceGrossOutputUnits,
    inputWei: event.args.sourceTokenInputWei,
    kind: "FLIP",
    marketVault: event.log.address,
    outputWei: event.args.destinationTokenOutputWei,
    side: event.args.sourceSide,
    trader: event.args.trader,
  });
});

ponder.on("MarketVault:CrownActivated", async ({ event, context }) => {
  await context.db.insert(crownEvents).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    contestId: event.args.contestId,
    marketVault: event.log.address,
    kind: "ACTIVATED",
    side: null,
    previousSide: null,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await context.db
    .update(marketStates, { marketVault: event.log.address })
    .set({
      crownActivated: true,
      qAWei: event.args.qAWei,
      qBWei: event.args.qBWei,
      reserveUnits: event.args.reserveUnits,
      updatedBlock: event.block.number,
      updatedAt: event.block.timestamp,
    });
});

ponder.on("MarketVault:CrownAssigned", async ({ event, context }) => {
  await context.db.insert(crownEvents).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    contestId: event.args.contestId,
    marketVault: event.log.address,
    kind: "ASSIGNED",
    side: event.args.crownSide,
    previousSide: null,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await context.db
    .update(marketStates, { marketVault: event.log.address })
    .set({
      crownSide: event.args.crownSide,
      qAWei: event.args.qAWei,
      qBWei: event.args.qBWei,
      updatedBlock: event.block.number,
      updatedAt: event.block.timestamp,
    });
});

ponder.on("MarketVault:CrownTransferred", async ({ event, context }) => {
  await context.db.insert(crownEvents).values({
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    contestId: event.args.contestId,
    marketVault: event.log.address,
    kind: "TRANSFERRED",
    side: event.args.newCrownSide,
    previousSide: event.args.previousCrownSide,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
  });
  await context.db
    .update(marketStates, { marketVault: event.log.address })
    .set({
      crownSide: event.args.newCrownSide,
      updatedBlock: event.block.number,
      updatedAt: event.block.timestamp,
    });
});

async function updateMarket(
  db: Parameters<Parameters<typeof ponder.on>[1]>[0]["context"]["db"],
  marketVault: `0x${string}`,
  next: {
    qAWei: bigint;
    qBWei: bigint;
    reserveUnits: bigint;
    volumeUnits: bigint;
    feeUnits: bigint;
    blockNumber: bigint;
    blockTimestamp: bigint;
  },
) {
  await db.update(marketStates, { marketVault }).set((row) => ({
    qAWei: next.qAWei,
    qBWei: next.qBWei,
    reserveUnits: next.reserveUnits,
    cumulativeVolumeUnits: row.cumulativeVolumeUnits + next.volumeUnits,
    cumulativeFeeUnits: row.cumulativeFeeUnits + next.feeUnits,
    tradeCount: row.tradeCount + 1n,
    publicCumulativeVolumeUnits: next.blockNumber >= publicMetricsStartBlock
      ? row.publicCumulativeVolumeUnits + next.volumeUnits
      : row.publicCumulativeVolumeUnits,
    publicCumulativeFeeUnits: next.blockNumber >= publicMetricsStartBlock
      ? row.publicCumulativeFeeUnits + next.feeUnits
      : row.publicCumulativeFeeUnits,
    publicTradeCount: next.blockNumber >= publicMetricsStartBlock
      ? row.publicTradeCount + 1n
      : row.publicTradeCount,
    updatedBlock: next.blockNumber,
    updatedAt: next.blockTimestamp,
  }));
}
