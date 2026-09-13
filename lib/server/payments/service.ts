import { createHash } from "node:crypto";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import type { Asset, CreatePaymentInput, PaymentStatus } from "../../contracts/payments";
import type { AuthenticatedMerchant } from "../auth/service";
import { db } from "../db/client";
import {
  idempotencyKeys,
  paymentIntents,
  paymentRecipients,
  paymentTransactions,
} from "../db/schema";
import { HttpError } from "../http";
import { assertPaymentTransition } from "./state";
import { normalizeCreatePayment } from "./validation";

const ACTIVE_TRANSACTION_STATUSES = ["PREPARED", "SUBMITTED", "CONFIRMING"] as const;

export type PaymentView = {
  id: string;
  merchantWallet: string;
  title: string;
  description: string | null;
  asset: Asset;
  amount: string;
  amountBaseUnits: string;
  status: PaymentStatus;
  reference: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipients: Array<{
    address: string;
    allocationBps: number;
    amountBaseUnits: string;
  }>;
};

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString("base64url");
}

function decodeCursor(cursor: string): [Date, string] {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[1] !== "string") throw new Error();
    const date = new Date(parsed[0]);
    if (Number.isNaN(date.getTime())) throw new Error();
    return [date, parsed[1]];
  } catch {
    throw new HttpError(400, "INVALID_CURSOR", "Pagination cursor is invalid.");
  }
}

function toView(
  payment: typeof paymentIntents.$inferSelect,
  recipients: Array<typeof paymentRecipients.$inferSelect>,
): PaymentView {
  return {
    id: payment.id,
    merchantWallet: payment.merchantWallet,
    title: payment.title,
    description: payment.description,
    asset: payment.asset,
    amount: payment.amountDisplay,
    amountBaseUnits: payment.amountBaseUnits.toString(),
    status: payment.status,
    reference: payment.externalReference,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    cancelledAt: payment.cancelledAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    recipients: recipients
      .sort((a, b) => a.position - b.position)
      .map((recipient) => ({
        address: recipient.walletAddress,
        allocationBps: recipient.allocationBps,
        amountBaseUnits: recipient.amountBaseUnits.toString(),
      })),
  };
}

async function expireOwnedPayments(merchantId: string): Promise<void> {
  await db
    .update(paymentIntents)
    .set({ status: "EXPIRED", updatedAt: new Date() })
    .where(
      and(
        eq(paymentIntents.merchantId, merchantId),
        inArray(paymentIntents.status, ["ACTIVE", "FAILED"]),
        isNotNull(paymentIntents.expiresAt),
        lt(paymentIntents.expiresAt, new Date()),
      ),
    );
}

export async function createPayment(
  merchant: AuthenticatedMerchant,
  input: CreatePaymentInput,
  idempotencyKey?: string | null,
): Promise<PaymentView> {
  const normalized = normalizeCreatePayment(input);
  if (idempotencyKey && !/^[\x21-\x7E]{1,128}$/.test(idempotencyKey)) {
    throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 1-128 visible ASCII characters.");
  }
  const hash = requestHash({
    ...normalized,
    amountBaseUnits: normalized.amountBaseUnits.toString(),
    expiresAt: normalized.expiresAt?.toISOString() ?? null,
    recipients: normalized.recipients.map((recipient) => ({
      ...recipient,
      amountBaseUnits: recipient.amountBaseUnits.toString(),
    })),
  });

  return db.transaction(async (tx) => {
    if (idempotencyKey) {
      const lockKey = `${merchant.id}:payments:create:${idempotencyKey}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const [existing] = await tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.subject, merchant.id),
            eq(idempotencyKeys.scope, "payments:create"),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key was used with another request.");
        }
        return existing.responseBody as PaymentView;
      }
    }

    const now = new Date();
    const [payment] = await tx
      .insert(paymentIntents)
      .values({
        merchantId: merchant.id,
        merchantWallet: merchant.walletAddress,
        title: normalized.title,
        description: normalized.description,
        asset: normalized.asset,
        amountDisplay: normalized.amount,
        amountBaseUnits: normalized.amountBaseUnits,
        status: "ACTIVE",
        externalReference: normalized.reference,
        expiresAt: normalized.expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const recipients = await tx
      .insert(paymentRecipients)
      .values(
        normalized.recipients.map((recipient, position) => ({
          paymentId: payment.id,
          position,
          walletAddress: recipient.address,
          allocationBps: recipient.allocationBps,
          amountBaseUnits: recipient.amountBaseUnits,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning();
    const view = toView(payment, recipients);

    if (idempotencyKey) {
      await tx.insert(idempotencyKeys).values({
        subject: merchant.id,
        scope: "payments:create",
        key: idempotencyKey,
        requestHash: hash,
        responseStatus: 201,
        responseBody: view,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
    }
    return view;
  });
}

export async function getOwnedPayment(
  merchant: AuthenticatedMerchant,
  paymentId: string,
): Promise<PaymentView> {
  await expireOwnedPayments(merchant.id);
  const [payment] = await db
    .select()
    .from(paymentIntents)
    .where(and(eq(paymentIntents.id, paymentId), eq(paymentIntents.merchantId, merchant.id)))
    .limit(1);
  if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
  const recipients = await db
    .select()
    .from(paymentRecipients)
    .where(eq(paymentRecipients.paymentId, payment.id));
  return toView(payment, recipients);
}

export async function listOwnedPayments(
  merchant: AuthenticatedMerchant,
  filters: {
    cursor?: string;
    limit: number;
    status?: PaymentStatus;
    asset?: Asset;
    search?: string;
  },
) {
  await expireOwnedPayments(merchant.id);
  const conditions = [eq(paymentIntents.merchantId, merchant.id)];
  if (filters.status) conditions.push(eq(paymentIntents.status, filters.status));
  if (filters.asset) conditions.push(eq(paymentIntents.asset, filters.asset));
  if (filters.search) {
    conditions.push(
      or(
        ilike(paymentIntents.title, `%${filters.search}%`),
        ilike(paymentIntents.description, `%${filters.search}%`),
        ilike(paymentIntents.externalReference, `%${filters.search}%`),
      )!,
    );
  }
  if (filters.cursor) {
    const [createdAt, id] = decodeCursor(filters.cursor);
    conditions.push(
      or(
        lt(paymentIntents.createdAt, createdAt),
        and(eq(paymentIntents.createdAt, createdAt), lt(paymentIntents.id, id)),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(paymentIntents)
    .where(and(...conditions))
    .orderBy(desc(paymentIntents.createdAt), desc(paymentIntents.id))
    .limit(filters.limit + 1);
  const page = rows.slice(0, filters.limit);
  const recipientRows = page.length
    ? await db
        .select()
        .from(paymentRecipients)
        .where(inArray(paymentRecipients.paymentId, page.map((payment) => payment.id)))
    : [];

  return {
    items: page.map((payment) =>
      toView(
        payment,
        recipientRows.filter((recipient) => recipient.paymentId === payment.id),
      ),
    ),
    nextCursor:
      rows.length > filters.limit && page.length
        ? encodeCursor(page.at(-1)!.createdAt, page.at(-1)!.id)
        : null,
  };
}

export async function cancelOwnedPayment(
  merchant: AuthenticatedMerchant,
  paymentId: string,
): Promise<PaymentView> {
  await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.id, paymentId), eq(paymentIntents.merchantId, merchant.id)))
      .for("update");
    if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    try {
      assertPaymentTransition(payment.status, "CANCELLED");
    } catch {
      throw new HttpError(409, "PAYMENT_STATE_CONFLICT", `Payment cannot be cancelled from ${payment.status}.`);
    }

    const [unresolved] = await tx
      .select({ id: paymentTransactions.id })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.paymentId, payment.id),
          inArray(paymentTransactions.status, ACTIVE_TRANSACTION_STATUSES),
        ),
      )
      .limit(1);
    if (unresolved) {
      throw new HttpError(409, "PAYMENT_ATTEMPT_UNRESOLVED", "Payment has an unresolved transaction attempt.");
    }
    await tx
      .update(paymentIntents)
      .set({ status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentIntents.id, payment.id));
  });
  return getOwnedPayment(merchant, paymentId);
}
