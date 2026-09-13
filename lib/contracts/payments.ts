export const ASSETS = ["SOL", "USDC"] as const;
export type Asset = (typeof ASSETS)[number];

export const PAYMENT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "CONFIRMING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentRecipientInput = {
  address: string;
  allocationBps: number;
};

export type CreatePaymentInput = {
  title: string;
  description?: string;
  asset: Asset;
  amount: string;
  recipients: PaymentRecipientInput[];
  expiresAt?: string;
  reference?: string;
};

export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
  requestId: string;
};
