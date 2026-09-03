export type TraderCostState = {
  costAUnits: bigint;
  costBUnits: bigint;
  qAWei: bigint;
  qBWei: bigint;
};

export type PerformanceTrade = {
  grossUnits: bigint;
  inputWei: bigint;
  kind: "BUY" | "FLIP" | "SELL";
  outputWei: bigint;
  side: number;
};

export function applyPerformanceTrade(state: TraderCostState, input: PerformanceTrade) {
  const next = { ...state };
  const sourceA = input.side === 0;
  let realizedCostUnits = 0n;
  let realizedPnlUnits = 0n;
  let sale = false;

  if (input.kind === "BUY") {
    if (sourceA) {
      next.qAWei += input.outputWei;
      next.costAUnits += input.grossUnits;
    } else {
      next.qBWei += input.outputWei;
      next.costBUnits += input.grossUnits;
    }
    return { ...next, realizedCostUnits, realizedPnlUnits, sale };
  }

  const quantity = sourceA ? next.qAWei : next.qBWei;
  const cost = sourceA ? next.costAUnits : next.costBUnits;
  const removed = input.inputWei > quantity ? quantity : input.inputWei;
  const removedCost = quantity > 0n ? cost * removed / quantity : 0n;
  if (sourceA) {
    next.qAWei -= removed;
    next.costAUnits -= removedCost;
  } else {
    next.qBWei -= removed;
    next.costBUnits -= removedCost;
  }
  if (input.kind === "FLIP") {
    if (sourceA) {
      next.qBWei += input.outputWei;
      next.costBUnits += removedCost;
    } else {
      next.qAWei += input.outputWei;
      next.costAUnits += removedCost;
    }
  } else if (removed > 0n && removedCost > 0n && input.inputWei > 0n) {
    const proceeds = input.outputWei * removed / input.inputWei;
    realizedCostUnits = removedCost;
    realizedPnlUnits = proceeds - removedCost;
    sale = true;
  }
  return { ...next, realizedCostUnits, realizedPnlUnits, sale };
}
