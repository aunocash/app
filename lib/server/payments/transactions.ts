import { createHash } from "node:crypto";

import { address, createSolanaRpc, signature } from "@solana/kit";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db/client";
import {
  idempotencyKeys,
  paymentIntents,
  paymentRecipients,
  paymentTransactions,
} from "../db/schema";
import { getServerEnv } from "../env";
import { HttpError } from "../http";
import { createReferenceAddress } from "../ids";
import { createPreparedAttemptToken } from "./attempt-token";
import {
  buildUnsignedPaymentTransaction,
  deriveRecipientTokenAccounts,
} from "../solana/transaction";
import { assertPaymentTransition } from "./state";

function assertTransition(from: typeof paymentIntents.$inferSelect.status, to: "AWAITING_SIGNATURE" | "SUBMITTED") {
  try {
    assertPaymentTransition(from, to);
  } catch {
    throw new HttpError(409, "PAYMENT_STATE_CONFLICT", `Payment cannot move from ${from} to ${to}.`);
  }
}

export async function preparePaymentTransaction(paymentId: string, payerWallet: string, idempotencyKey?: string | null) {
  if (idempotencyKey && !/^[\x21-\x7E]{1,128}$/.test(idempotencyKey)) {
    throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 1-128 visible ASCII characters.");
  }
  let payer: string;
  try {
    payer = address(payerWallet);
  } catch {
    throw new HttpError(400, "INVALID_PAYER", "Payer wallet is invalid.");
  }

  const [payment] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, paymentId)).limit(1);
  if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
  const idempotencySubject = `${payment.id}:${payer}`;
  const idempotencyHash = createHash("sha256").update(JSON.stringify({ paymentId: payment.id, payer })).digest("hex");
  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.subject, idempotencySubject), eq(idempotencyKeys.scope, "payments:prepare"), eq(idempotencyKeys.key, idempotencyKey)))
      .limit(1);
    if (existing) {
      if (existing.requestHash !== idempotencyHash) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key was used with another request.");
      return existing.responseBody as { transactionId: string; abandonToken: string; serializedTransaction: string; reference: string; network: "devnet" | "mainnet-beta"; recentBlockhash: string; lastValidBlockHeight: string };
    }
  }
  if (
    payment.expiresAt &&
    payment.expiresAt <= new Date() &&
    (payment.status === "ACTIVE" || payment.status === "FAILED")
  ) {
    await db
      .update(paymentIntents)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(paymentIntents.id, payment.id), eq(paymentIntents.status, payment.status)));
    throw new HttpError(410, "PAYMENT_EXPIRED", "Payment has expired.");
  }
  assertTransition(payment.status, "AWAITING_SIGNATURE");  const recipients = await db
    .select()
    .from(paymentRecipients)
    .where(eq(paymentRecipients.paymentId, payment.id))
    .orderBy(paymentRecipients.position);
  const transfers = recipients.map((recipient) => ({
    address: recipient.walletAddress,
    amountBaseUnits: recipient.amountBaseUnits,
  }));
  const env = getServerEnv();
  const rpc = createSolanaRpc(env.SOLANA_RPC_URL);
  const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  let existingTokenAccounts = new Set<string>();
  if (payment.asset === "USDC") {
    const tokenAccounts = await deriveRecipientTokenAccounts(transfers, env.USDC_MINT);
    const { value: accounts } = await rpc
      .getMultipleAccounts(tokenAccounts.map((tokenAccount) => address(tokenAccount)), {
        commitment: "confirmed",
        encoding: "base64",
      })
      .send();
    existingTokenAccounts = new Set(
      tokenAccounts.filter((_, index) => accounts[index] !== null),
    );
  }

  const referenceAddress = createReferenceAddress();
  const preparedAttempt = createPreparedAttemptToken();
  let built;
  try {
    built = await buildUnsignedPaymentTransaction({
      asset: payment.asset,
      payer,
      reference: referenceAddress,
      recipients: transfers,
      lifetime,
      usdcMint: env.USDC_MINT,
      existingTokenAccounts,
    });
  } catch {
    throw new HttpError(422, "TRANSACTION_UNSAFE", "Payment does not fit one safe atomic transaction.");
  }

  try {
    return await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const lockKey = `${idempotencySubject}:payments:prepare:${idempotencyKey}`;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
        const [existing] = await tx
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.subject, idempotencySubject), eq(idempotencyKeys.scope, "payments:prepare"), eq(idempotencyKeys.key, idempotencyKey)))
          .limit(1);
        if (existing) {
          if (existing.requestHash !== idempotencyHash) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key was used with another request.");
          return existing.responseBody as { transactionId: string; abandonToken: string; serializedTransaction: string; reference: string; network: "devnet" | "mainnet-beta"; recentBlockhash: string; lastValidBlockHeight: string };
        }
      }
      const [locked] = await tx
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, payment.id))
        .for("update");
      if (!locked) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
      if (locked.expiresAt && locked.expiresAt <= new Date()) {
        throw new HttpError(410, "PAYMENT_EXPIRED", "Payment has expired.");
      }
      assertTransition(locked.status, "AWAITING_SIGNATURE");

      const now = new Date();
      const [attempt] = await tx
        .insert(paymentTransactions)
        .values({
          paymentId: payment.id,
          payerWallet: payer,
          network: env.SOLANA_NETWORK,
          asset: payment.asset,
          referenceAddress,
          abandonTokenHash: preparedAttempt.hash,
          status: "PREPARED",
          nextVerificationAt: now,
          expectedTransfers: transfers.map((transfer) => ({
            recipient: transfer.address,
            amountBaseUnits: transfer.amountBaseUnits.toString(),
          })),
          recentBlockhash: lifetime.blockhash,
          lastValidBlockHeight: lifetime.lastValidBlockHeight,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: paymentTransactions.id });
      await tx
        .update(paymentIntents)
        .set({ status: "AWAITING_SIGNATURE", lastErrorCode: null, updatedAt: now })
        .where(eq(paymentIntents.id, payment.id));

      const response = {
        transactionId: attempt.id,
        abandonToken: preparedAttempt.token,
        serializedTransaction: built.serializedTransaction,
        reference: referenceAddress,
        network: env.SOLANA_NETWORK,
        recentBlockhash: lifetime.blockhash,
        lastValidBlockHeight: lifetime.lastValidBlockHeight.toString(),
      };
      if (idempotencyKey) {
        await tx.insert(idempotencyKeys).values({
          subject: idempotencySubject,
          scope: "payments:prepare",
          key: idempotencyKey,
          requestHash: idempotencyHash,
          responseStatus: 201,
          responseBody: response,
          expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        });
      }
      return response;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new HttpError(409, "PAYMENT_ATTEMPT_UNRESOLVED", "Payment already has an unresolved attempt.");
    }
    throw error;
  }
}

export async function submitPaymentTransaction(
  paymentId: string,
  transactionId: string,
  signatureValue: string,
) {
  try {
    signature(signatureValue);
  } catch {
    throw new HttpError(400, "INVALID_SIGNATURE", "Transaction signature is invalid.");
  }

  try {
    return await db.transaction(async (tx) => {
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
      if (!attempt) throw new HttpError(404, "TRANSACTION_NOT_FOUND", "Transaction attempt was not found.");
      if (attempt.status === "SUBMITTED" && attempt.signature === signatureValue) {
        return { transactionId: attempt.id, signature: signatureValue, status: "SUBMITTED" as const };
      }
      if (attempt.status !== "PREPARED") {
        throw new HttpError(409, "TRANSACTION_STATE_CONFLICT", "Transaction is not awaiting submission.");
      }

      const [payment] = await tx
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, paymentId))
        .for("update");
      if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
      assertTransition(payment.status, "SUBMITTED");

      const now = new Date();
      await tx
        .update(paymentTransactions)
        .set({
          signature: signatureValue,
          status: "SUBMITTED",
          submittedAt: now,
          nextVerificationAt: now,
          updatedAt: now,
        })
        .where(eq(paymentTransactions.id, attempt.id));
      await tx
        .update(paymentIntents)
        .set({ status: "SUBMITTED", updatedAt: now })
        .where(eq(paymentIntents.id, payment.id));
      return { transactionId: attempt.id, signature: signatureValue, status: "SUBMITTED" as const };
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new HttpError(409, "SIGNATURE_ALREADY_USED", "Signature is already assigned to another payment.");
    }
    throw error;
  }
}
