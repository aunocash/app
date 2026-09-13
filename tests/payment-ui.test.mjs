import assert from "node:assert/strict";
import test from "node:test";

import {
  allocationToBasisPoints,
  formatBaseUnits,
  paymentStatusPresentation,
} from "../lib/client/payment-ui.ts";

test("converts two-decimal allocation percentages to exact basis points", () => {
  assert.equal(allocationToBasisPoints("80"), 8000);
  assert.equal(allocationToBasisPoints("12.34"), 1234);
  assert.equal(allocationToBasisPoints("0.01"), 1);
  assert.throws(() => allocationToBasisPoints("12.345"));
  assert.throws(() => allocationToBasisPoints("0"));
});

test("formats base units without floating point rounding", () => {
  assert.equal(formatBaseUnits("1000001", "USDC"), "1.000001");
  assert.equal(formatBaseUnits("1", "SOL"), "0.000000001");
  assert.equal(formatBaseUnits("1000000000", "SOL"), "1");
});

test("maps payment states to safe checkout actions", () => {
  assert.equal(paymentStatusPresentation("ACTIVE").canPay, true);
  assert.equal(paymentStatusPresentation("FAILED").canPay, true);
  assert.equal(paymentStatusPresentation("SUBMITTED").shouldPoll, true);
  assert.equal(paymentStatusPresentation("PAID").terminal, true);
  assert.equal(paymentStatusPresentation("CANCELLED").canPay, false);
});
