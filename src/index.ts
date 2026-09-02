import { ponder } from "ponder:registry";
import { contests, marketStates, trades } from "ponder:schema";

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
});

ponder.on("MarketVault:CrownActivated", async ({ event, context }) => {
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
    updatedBlock: next.blockNumber,
    updatedAt: next.blockTimestamp,
  }));
}
