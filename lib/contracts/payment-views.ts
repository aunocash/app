import type { Asset, PaymentStatus } from "./payments";

export type PaymentRecipientView = {
  address: string;
  allocationBps: number;
  amountBaseUnits: string;
};

export type PublicPaymentView = {
  id: string;
  title: string;
  description: string | null;
  asset: Asset;
  amount: string;
  amountBaseUnits: string;
  status: PaymentStatus;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  failureCode: string | null;
  canPay: boolean;
  receiptAvailable: boolean;
  recipients: PaymentRecipientView[];
};

type PaymentSource = {
  id: string;
  title: string;
  description: string | null;
  asset: Asset;
  amountDisplay: string;
  amountBaseUnits: bigint;
  status: PaymentStatus;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastErrorCode: string | null;
};

type RecipientSource = {
  walletAddress: string;
  allocationBps: number;
  amountBaseUnits: bigint;
  position: number;
};

export function toPublicPaymentView(
  payment: PaymentSource,
  recipients: RecipientSource[],
  receiptAvailable: boolean,
): PublicPaymentView {
  return {
    id: payment.id,
    title: payment.title,
    description: payment.description,
    asset: payment.asset,
    amount: payment.amountDisplay,
    amountBaseUnits: payment.amountBaseUnits.toString(),
    status: payment.status,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    failureCode: payment.lastErrorCode,
    canPay: payment.status === "ACTIVE" || payment.status === "FAILED",
    receiptAvailable,
    recipients: [...recipients]
      .sort((left, right) => left.position - right.position)
      .map((recipient) => ({
        address: recipient.walletAddress,
        allocationBps: recipient.allocationBps,
        amountBaseUnits: recipient.amountBaseUnits.toString(),
      })),
  };
}

export type PaymentSummary = {
  total: number;
  active: number;
  pending: number;
  paid: number;
  failed: number;
  expired: number;
  cancelled: number;
};

export function summarizePaymentStatuses(
  payments: Array<{ status: PaymentStatus }>,
): PaymentSummary {
  const summary: PaymentSummary = {
    total: payments.length,
    active: 0,
    pending: 0,
    paid: 0,
    failed: 0,
    expired: 0,
    cancelled: 0,
  };
  for (const payment of payments) {
    if (payment.status === "ACTIVE") summary.active += 1;
    else if (["AWAITING_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(payment.status)) {
      summary.pending += 1;
    } else if (payment.status === "PAID") summary.paid += 1;
    else if (payment.status === "FAILED") summary.failed += 1;
    else if (payment.status === "EXPIRED") summary.expired += 1;
    else if (payment.status === "CANCELLED") summary.cancelled += 1;
  }
  return summary;
}
