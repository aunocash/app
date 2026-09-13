import type { Asset, PaymentStatus } from "@/lib/contracts/payments";

const ASSET_DECIMALS: Record<Asset, number> = { SOL: 9, USDC: 6 };

export type PaymentStatusPresentation = {
  label: string;
  detail: string;
  canPay: boolean;
  shouldPoll: boolean;
  terminal: boolean;
  tone: "neutral" | "pending" | "success" | "danger";
};

const PAYMENT_STATUS_PRESENTATIONS: Record<PaymentStatus, PaymentStatusPresentation> = {
  DRAFT: {
    label: "Draft",
    detail: "This payment is not ready to accept funds.",
    canPay: false,
    shouldPoll: false,
    terminal: false,
    tone: "neutral",
  },
  ACTIVE: {
    label: "Ready for payment",
    detail: "Review the details, then approve in your wallet.",
    canPay: true,
    shouldPoll: false,
    terminal: false,
    tone: "neutral",
  },
  AWAITING_SIGNATURE: {
    label: "Awaiting wallet approval",
    detail: "Approve the prepared transaction in your wallet.",
    canPay: false,
    shouldPoll: true,
    terminal: false,
    tone: "pending",
  },
  SUBMITTED: {
    label: "Transaction submitted",
    detail: "The payment is being observed on Solana.",
    canPay: false,
    shouldPoll: true,
    terminal: false,
    tone: "pending",
  },
  CONFIRMING: {
    label: "Finalizing payment",
    detail: "AUNO is verifying the finalized transaction.",
    canPay: false,
    shouldPoll: true,
    terminal: false,
    tone: "pending",
  },
  PAID: {
    label: "Payment verified",
    detail: "The finalized payment and receipt are ready.",
    canPay: false,
    shouldPoll: false,
    terminal: true,
    tone: "success",
  },
  FAILED: {
    label: "Payment needs another attempt",
    detail: "No verified payment was recorded. You can prepare a new transaction.",
    canPay: true,
    shouldPoll: false,
    terminal: false,
    tone: "danger",
  },
  EXPIRED: {
    label: "Payment expired",
    detail: "This request can no longer accept a new transaction.",
    canPay: false,
    shouldPoll: false,
    terminal: true,
    tone: "danger",
  },
  CANCELLED: {
    label: "Payment cancelled",
    detail: "The merchant cancelled this request before settlement.",
    canPay: false,
    shouldPoll: false,
    terminal: true,
    tone: "neutral",
  },
};

export function allocationToBasisPoints(value: string): number {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Allocation must use up to two decimal places.");
  }
  const [whole, decimal = ""] = value.split(".");
  const basisPoints = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isInteger(basisPoints) || basisPoints < 1 || basisPoints > 10_000) {
    throw new Error("Allocation must be between 0.01% and 100%.");
  }
  return basisPoints;
}

export function formatBaseUnits(value: string, asset: Asset): string {
  if (!/^\d+$/.test(value)) throw new Error("Base-unit amount must be a positive integer string.");
  const decimals = ASSET_DECIMALS[asset];
  const normalized = value.replace(/^0+(?=\d)/, "");
  if (normalized.length <= decimals) return `0.${normalized.padStart(decimals, "0")}`;
  const whole = normalized.slice(0, -decimals);
  const fraction = normalized.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function paymentStatusPresentation(status: PaymentStatus): PaymentStatusPresentation {
  return PAYMENT_STATUS_PRESENTATIONS[status];
}
