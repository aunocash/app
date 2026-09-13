import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCreatePayment } from "../lib/server/payments/validation.ts";
import { assertPaymentTransition } from "../lib/server/payments/state.ts";

const walletA = "11111111111111111111111111111111";
const walletB = "11111111111111111111111111111112";

test("normalizes a standard USDC payment into immutable base-unit recipients", () => {
  const value = normalizeCreatePayment(
    {
      title: "  Invoice 42  ",
      asset: "USDC",
      amount: "1.000001",
      recipients: [{ address: walletA, allocationBps: 10_000 }],
    },
    new Date("2026-09-13T00:00:00.000Z"),
  );

  assert.deepEqual(value, {
    title: "Invoice 42",
    description: null,
    asset: "USDC",
    amount: "1.000001",
    amountBaseUnits: 1_000_001n,
    recipients: [
      { address: walletA, allocationBps: 10_000, amountBaseUnits: 1_000_001n },
    ],
    expiresAt: null,
    reference: null,
  });
});

test("rejects duplicate recipients, invalid totals, past expiry, and zero-value recipient shares", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  const base = {
    title: "Invoice",
    asset: "SOL",
    amount: "1",
    recipients: [
      { address: walletA, allocationBps: 5000 },
      { address: walletB, allocationBps: 5000 },
    ],
  };

  assert.throws(() => normalizeCreatePayment({ ...base, recipients: base.recipients.map((item) => ({ ...item, address: walletA })) }, now));
  assert.throws(() => normalizeCreatePayment({ ...base, recipients: base.recipients.map((item) => ({ ...item, allocationBps: 4000 })) }, now));
  assert.throws(() => normalizeCreatePayment({ ...base, expiresAt: "2026-09-12T23:59:59.000Z" }, now));
  assert.throws(() => normalizeCreatePayment({ ...base, amount: "0.000000001" }, now));
});

test("enforces payment lifecycle transitions and terminal paid state", () => {
  assert.doesNotThrow(() => assertPaymentTransition("ACTIVE", "AWAITING_SIGNATURE"));
  assert.doesNotThrow(() => assertPaymentTransition("FAILED", "AWAITING_SIGNATURE"));
  assert.doesNotThrow(() => assertPaymentTransition("CONFIRMING", "PAID"));
  assert.throws(() => assertPaymentTransition("SUBMITTED", "CANCELLED"));
  assert.throws(() => assertPaymentTransition("PAID", "ACTIVE"));
});
