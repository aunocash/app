import { and, eq } from "drizzle-orm";

import { db } from "@/lib/server/db/client";
import { paymentIntents, paymentTransactions } from "@/lib/server/db/schema";
import { HttpError } from "@/lib/server/http";
import { matchesPreparedAttemptToken } from "./attempt-token";

export async function abandonPreparedPaymentTransaction(
  paymentId: string,
  transactionId: string,
  abandonToken: string,
): Promise<{ transactionId: string; status: "FAILED" }> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.id, transactionId),
          eq(paymentTransactions.paymentId, paymentId),
        ),
      )
      .for("update");
    if (!attempt || !attempt.abandonTokenHash || !matchesPreparedAttemptToken(abandonToken, attempt.abandonTokenHash)) {
      throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction attempt was not found.");
    }
    if (attempt.status !== "PREPARED" || attempt.signature) {
      throw new HttpError(409, "TRANSACTION_STATE_CONFLICT", "Transaction is no longer awaiting wallet approval.");
    }
    const [payment] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, paymentId))
      .for("update");
    if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    const now = new Date();
    await tx
      .update(paymentTransactions)
      .set({
        status: "FAILED",
        failureCode: "WALLET_REJECTED",
        abandonTokenHash: null,
        nextVerificationAt: null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(eq(paymentTransactions.id, attempt.id));
    if (payment.status === "AWAITING_SIGNATURE") {
      await tx
        .update(paymentIntents)
        .set({ status: "FAILED", lastErrorCode: "WALLET_REJECTED", updatedAt: now })
        .where(eq(paymentIntents.id, payment.id));
    }
    return { transactionId: attempt.id, status: "FAILED" };
  });
}
