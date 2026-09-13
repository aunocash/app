import type { PaymentStatus } from "../../contracts/payments.ts";

const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["AWAITING_SIGNATURE", "EXPIRED", "CANCELLED"],
  AWAITING_SIGNATURE: ["ACTIVE", "SUBMITTED", "FAILED", "EXPIRED"],
  SUBMITTED: ["CONFIRMING", "PAID", "FAILED"],
  CONFIRMING: ["PAID", "FAILED"],
  PAID: [],
  FAILED: ["AWAITING_SIGNATURE", "EXPIRED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
};

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}
