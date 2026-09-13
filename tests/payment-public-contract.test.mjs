import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizePaymentStatuses,
  toPublicPaymentView,
} from "../lib/contracts/payment-views.ts";

const payment = {
  id: "pay_public",
  merchantWallet: "merchant-wallet",
  title: "Design retainer",
  description: "September work",
  asset: "USDC",
  amountDisplay: "12.5",
  amountBaseUnits: 12_500_000n,
  status: "ACTIVE",
  externalReference: "internal-42",
  expiresAt: new Date("2026-09-14T00:00:00.000Z"),
  paidAt: null,
  cancelledAt: null,
  lastErrorCode: null,
  createdAt: new Date("2026-09-13T00:00:00.000Z"),
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
};

const recipients = [
  {
    walletAddress: "recipient-one",
    allocationBps: 8000,
    amountBaseUnits: 10_000_000n,
    position: 0,
  },
  {
    walletAddress: "recipient-two",
    allocationBps: 2000,
    amountBaseUnits: 2_500_000n,
    position: 1,
  },
];

test("creates a sanitized public payment view", () => {
  const view = toPublicPaymentView(payment, recipients, false);

  assert.deepEqual(view, {
    id: "pay_public",
    title: "Design retainer",
    description: "September work",
    asset: "USDC",
    amount: "12.5",
    amountBaseUnits: "12500000",
    status: "ACTIVE",
    expiresAt: "2026-09-14T00:00:00.000Z",
    paidAt: null,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    failureCode: null,
    canPay: true,
    receiptAvailable: false,
    recipients: [
      { address: "recipient-one", allocationBps: 8000, amountBaseUnits: "10000000" },
      { address: "recipient-two", allocationBps: 2000, amountBaseUnits: "2500000" },
    ],
  });
  assert.equal("merchantWallet" in view, false);
  assert.equal("reference" in view, false);
});

test("summarizes payment statuses without mixing monetary assets", () => {
  assert.deepEqual(
    summarizePaymentStatuses([
      { status: "ACTIVE" },
      { status: "PAID" },
      { status: "PAID" },
      { status: "FAILED" },
    ]),
    { total: 4, active: 1, pending: 0, paid: 2, failed: 1, expired: 0, cancelled: 0 },
  );
});
