import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { paymentReceipts } from "../db/schema";
import { HttpError } from "../http";

export async function getPaymentReceipt(paymentId: string) {
  const [receipt] = await db
    .select()
    .from(paymentReceipts)
    .where(eq(paymentReceipts.paymentId, paymentId))
    .limit(1);
  if (!receipt) throw new HttpError(404, "RECEIPT_NOT_FOUND", "A finalized receipt is not available.");

  return {
    id: receipt.id,
    paymentId: receipt.paymentId,
    transactionId: receipt.transactionId,
    signature: receipt.signature,
    payerWallet: receipt.payerWallet,
    network: receipt.network,
    slot: receipt.slot.toString(),
    finalizedAt: receipt.finalizedAt.toISOString(),
    explorerUrl: `https://explorer.solana.com/tx/${receipt.signature}?cluster=${receipt.network}`,
  };
}
