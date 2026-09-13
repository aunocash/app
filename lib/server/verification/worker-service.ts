import { createSolanaRpc, signature as solanaSignature } from "@solana/kit";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db, pool } from "../db/client";
import {
  paymentIntents,
  paymentReceipts,
  paymentTransactions,
} from "../db/schema";
import { getServerEnv } from "../env";
import { logEvent } from "../http";
import { verifyFinalizedTransaction } from "./verify-transaction";

type Attempt = typeof paymentTransactions.$inferSelect;

export async function claimVerificationAttempts(workerId: string, limit: number): Promise<Attempt[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM payment_transactions
       WHERE status IN ('PREPARED', 'SUBMITTED', 'CONFIRMING')
         AND (next_verification_at IS NULL OR next_verification_at <= now())
         AND (locked_at IS NULL OR locked_at < now() - interval '30 seconds')
       ORDER BY COALESCE(next_verification_at, created_at), created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [limit],
    );
    const ids = result.rows.map((row) => row.id);
    if (ids.length) {
      await client.query(
        `UPDATE payment_transactions
         SET locked_at = now(), locked_by = $1, updated_at = now()
         WHERE id = ANY($2::text[])`,
        [workerId, ids],
      );
    }
    await client.query("COMMIT");
    if (!ids.length) return [];
    return db.select().from(paymentTransactions).where(inArray(paymentTransactions.id, ids));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function retryAttempt(attempt: Attempt, workerId: string): Promise<void> {
  const delaySeconds = Math.min(60, 2 ** Math.min(attempt.verificationAttempts + 1, 6));
  await db
    .update(paymentTransactions)
    .set({
      verificationAttempts: sql`${paymentTransactions.verificationAttempts} + 1`,
      nextVerificationAt: new Date(Date.now() + delaySeconds * 1000),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentTransactions.id, attempt.id), eq(paymentTransactions.lockedBy, workerId)));
}

async function failAttempt(attempt: Attempt, workerId: string, code: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [lockedAttempt] = await tx
      .select({ id: paymentTransactions.id, lockedBy: paymentTransactions.lockedBy })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, attempt.id))
      .for("update");
    if (!lockedAttempt || lockedAttempt.lockedBy !== workerId) return;
    const [payment] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, attempt.paymentId))
      .for("update");
    if (!payment || payment.status === "PAID") return;
    const expired = payment.expiresAt !== null && payment.expiresAt <= new Date();
    await tx
      .update(paymentTransactions)
      .set({
        status: code === "BLOCKHASH_EXPIRED" ? "EXPIRED" : "FAILED",
        failureCode: code,
        verificationAttempts: sql`${paymentTransactions.verificationAttempts} + 1`,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(paymentTransactions.id, attempt.id), eq(paymentTransactions.lockedBy, workerId)));
    await tx
      .update(paymentIntents)
      .set({ status: expired ? "EXPIRED" : "FAILED", lastErrorCode: code, updatedAt: new Date() })
      .where(eq(paymentIntents.id, attempt.paymentId));
  });
}

async function markConfirming(attempt: Attempt, workerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [lockedAttempt] = await tx
      .select({ id: paymentTransactions.id, lockedBy: paymentTransactions.lockedBy })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, attempt.id))
      .for("update");
    if (!lockedAttempt || lockedAttempt.lockedBy !== workerId) return;
    const now = new Date();
    await tx
      .update(paymentTransactions)
      .set({
        status: "CONFIRMING",
        confirmedAt: attempt.confirmedAt ?? now,
        nextVerificationAt: new Date(now.getTime() + 2_000),
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(and(eq(paymentTransactions.id, attempt.id), eq(paymentTransactions.lockedBy, workerId)));
    await tx
      .update(paymentIntents)
      .set({ status: "CONFIRMING", updatedAt: now })
      .where(and(eq(paymentIntents.id, attempt.paymentId), inArray(paymentIntents.status, ["SUBMITTED", "CONFIRMING"])));
  });
}

async function markPaid(
  attempt: Attempt,
  workerId: string,
  slot: bigint,
  finalizedAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, attempt.id))
      .for("update");
    if (
      !locked ||
      locked.lockedBy !== workerId ||
      locked.status === "VERIFIED" ||
      !locked.signature
    ) return;
    const now = new Date();
    await tx.insert(paymentReceipts).values({
      paymentId: locked.paymentId,
      transactionId: locked.id,
      signature: locked.signature,
      payerWallet: locked.payerWallet,
      network: locked.network,
      slot,
      finalizedAt,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(paymentTransactions)
      .set({
        status: "VERIFIED",
        finalizedAt,
        verifiedAt: now,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      })
      .where(and(eq(paymentTransactions.id, locked.id), eq(paymentTransactions.lockedBy, workerId)));
    await tx
      .update(paymentIntents)
      .set({ status: "PAID", paidAt: finalizedAt, lastErrorCode: null, updatedAt: now })
      .where(eq(paymentIntents.id, locked.paymentId));
  });
}

export async function processVerificationAttempt(attempt: Attempt, workerId: string): Promise<void> {
  const env = getServerEnv();
  if (attempt.network !== env.SOLANA_NETWORK) {
    await failAttempt(attempt, workerId, "NETWORK_MISMATCH");
    return;
  }
  const rpc = createSolanaRpc(env.SOLANA_RPC_URL);

  try {
    if (!attempt.signature) {
      const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > attempt.lastValidBlockHeight) {
        await failAttempt(attempt, workerId, "BLOCKHASH_EXPIRED");
      } else {
        await retryAttempt(attempt, workerId);
      }
      return;
    }

    const signature = solanaSignature(attempt.signature);
    const { value: statuses } = await rpc
      .getSignatureStatuses([signature], { searchTransactionHistory: true })
      .send();
    const status = statuses[0];
    if (!status) {
      const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > attempt.lastValidBlockHeight) {
        await failAttempt(attempt, workerId, "BLOCKHASH_EXPIRED");
      } else {
        await retryAttempt(attempt, workerId);
      }
      return;
    }
    if (status.err !== null) {
      await failAttempt(attempt, workerId, "CHAIN_EXECUTION_FAILED");
      return;
    }
    if (status.confirmationStatus !== "finalized") {
      if (status.confirmationStatus === "confirmed") await markConfirming(attempt, workerId);
      else await retryAttempt(attempt, workerId);
      return;
    }

    const observed = await rpc
      .getTransaction(signature, {
        commitment: "finalized",
        encoding: "json",
        maxSupportedTransactionVersion: 0,
      })
      .send();
    if (!observed) {
      await retryAttempt(attempt, workerId);
      return;
    }
    const verification = await verifyFinalizedTransaction({
      observation: observed,
      signature: attempt.signature,
      payer: attempt.payerWallet,
      asset: attempt.asset,
      reference: attempt.referenceAddress,
      recentBlockhash: attempt.recentBlockhash,
      expectedTransfers: attempt.expectedTransfers,
      usdcMint: env.USDC_MINT,
    });
    if (!verification.ok) {
      await failAttempt(attempt, workerId, verification.code);
      return;
    }
    const finalizedAt = observed.blockTime
      ? new Date(Number(observed.blockTime) * 1000)
      : new Date();
    await markPaid(attempt, workerId, verification.slot, finalizedAt);
  } catch (error) {
    logEvent("warn", "verification.transient_error", { transactionId: attempt.id, error });
    await retryAttempt(attempt, workerId);
  }
}
