import assert from "node:assert/strict";
import test from "node:test";

import { applyPerformanceTrade } from "../src/trader-performance";

const empty = { qAWei: 0n, qBWei: 0n, costAUnits: 0n, costBUnits: 0n };

test("buy then partial sell realizes proportional cost", () => {
  const bought = applyPerformanceTrade(empty, {
    kind: "BUY", side: 0, grossUnits: 100_000_000n, inputWei: 100_000_000n, outputWei: 100n,
  });
  const sold = applyPerformanceTrade(bought, {
    kind: "SELL", side: 0, grossUnits: 60_000_000n, inputWei: 50n, outputWei: 59_400_000n,
  });
  assert.equal(sold.qAWei, 50n);
  assert.equal(sold.costAUnits, 50_000_000n);
  assert.equal(sold.realizedCostUnits, 50_000_000n);
  assert.equal(sold.realizedPnlUnits, 9_400_000n);
});

test("flip carries cost without realizing profit", () => {
  const bought = applyPerformanceTrade(empty, {
    kind: "BUY", side: 0, grossUnits: 100_000_000n, inputWei: 100_000_000n, outputWei: 100n,
  });
  const flipped = applyPerformanceTrade(bought, {
    kind: "FLIP", side: 0, grossUnits: 50_000_000n, inputWei: 50n, outputWei: 45n,
  });
  assert.equal(flipped.costAUnits, 50_000_000n);
  assert.equal(flipped.costBUnits, 50_000_000n);
  assert.equal(flipped.qBWei, 45n);
  assert.equal(flipped.sale, false);
});
