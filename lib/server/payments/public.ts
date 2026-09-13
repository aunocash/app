import { and, eq, inArray, lt } from "drizzle-orm";

import {
  summarizePaymentStatuses,
  toPublicPaymentView,
  type PaymentSummary,
  type PublicPaymentView,
} from "@/lib/contracts/payment-views";
import type { AuthenticatedMerchant } from "@/lib/server/auth/service";
import { db } from "@/lib/server/db/client";
import {
  merchants,
  paymentIntents,
  paymentReceipts,
  paymentRecipients,
} from "@/lib/server/db/schema";
import { HttpError } from "@/lib/server/http";

const EXPIRABLE_STATUSES = ["ACTIVE", "FAILED"] as const;

async function expireIfNeeded(payment: typeof paymentIntents.$inferSelect) {
  if (
    payment.expiresAt &&
    payment.expiresAt <= new Date() &&
    EXPIRABLE_STATUSES.includes(payment.status as (typeof EXPIRABLE_STATUSES)[number])
  ) {
    await db
      .update(paymentIntents)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(paymentIntents.id, payment.id), inArray(paymentIntents.status, EXPIRABLE_STATUSES)));
    return { ...payment, status: "EXPIRED" as const, updatedAt: new Date() };
  }
  return payment;
}

export async function getPublicPayment(paymentId: string): Promise<PublicPaymentView> {
  const [storedPayment] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.id, paymentId))
    .limit(1);
  if (!storedPayment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
  const payment = await expireIfNeeded(storedPayment);
  const [recipients, receipts] = await Promise.all([
    db.select().from(paymentRecipients).where(eq(paymentRecipients.paymentId, payment.id)),
    db
      .select({ id: paymentReceipts.id })
      .from(paymentReceipts)
      .where(eq(paymentReceipts.paymentId, payment.id))
      .limit(1),
  ]);
  return toPublicPaymentView(payment, recipients, receipts.length > 0);
}

export async function getOwnedPaymentSummary(
  merchant: AuthenticatedMerchant,
): Promise<PaymentSummary> {
  await db
    .update(paymentIntents)
    .set({ status: "EXPIRED", updatedAt: new Date() })
    .where(
      and(
        eq(paymentIntents.merchantId, merchant.id),
        inArray(paymentIntents.status, EXPIRABLE_STATUSES),
        lt(paymentIntents.expiresAt, new Date()),
      ),
    );
  const statuses = await db
    .select({ status: paymentIntents.status })
    .from(paymentIntents)
    .where(eq(paymentIntents.merchantId, merchant.id));
  return summarizePaymentStatuses(statuses);
}

export async function createDevnetDemoPayment(options: {
  recipientWallet: string;
  expiresAt: Date;
}): Promise<PublicPaymentView> {
  const now = new Date();
  const [payment, recipients] = await db.transaction(async (tx) => {
    const [merchant] = await tx
      .insert(merchants)
      .values({ walletAddress: options.recipientWallet, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: merchants.walletAddress,
        set: { updatedAt: now },
      })
      .returning({ id: merchants.id, walletAddress: merchants.walletAddress });
    const [createdPayment] = await tx
      .insert(paymentIntents)
      .values({
        merchantId: merchant.id,
        merchantWallet: merchant.walletAddress,
        title: "AUNO Devnet Checkout",
        description: "A live 0.001 SOL payment on Solana devnet.",
        asset: "SOL",
        amountDisplay: "0.001",
        amountBaseUnits: 1_000_000n,
        status: "ACTIVE",
        expiresAt: options.expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const createdRecipients = await tx
      .insert(paymentRecipients)
      .values({
        paymentId: createdPayment.id,
        position: 0,
        walletAddress: merchant.walletAddress,
        allocationBps: 10_000,
        amountBaseUnits: 1_000_000n,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return [createdPayment, createdRecipients] as const;
  });
  return toPublicPaymentView(payment, recipients, false);
}
