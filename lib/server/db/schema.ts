import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { ASSETS, PAYMENT_STATUSES } from "../../contracts/payments";
import { createId } from "../ids";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const assetEnum = pgEnum("asset", ASSETS);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "PREPARED",
  "SUBMITTED",
  "CONFIRMING",
  "VERIFIED",
  "FAILED",
  "EXPIRED",
]);

export const merchants = pgTable(
  "merchants",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("mrc")),
    walletAddress: text("wallet_address").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("merchants_wallet_address_uidx").on(table.walletAddress)],
);

export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("chl")),
    walletAddress: text("wallet_address").notNull(),
    nonce: text("nonce").notNull(),
    message: text("message").notNull(),
    domain: text("domain").notNull(),
    uri: text("uri").notNull(),
    chainId: text("chain_id").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_challenges_nonce_uidx").on(table.nonce),
    index("auth_challenges_wallet_idx").on(table.walletAddress),
    index("auth_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("ses")),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_merchant_idx").on(table.merchantId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("pay")),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    merchantWallet: text("merchant_wallet").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    asset: assetEnum("asset").notNull(),
    amountDisplay: text("amount_display").notNull(),
    amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
    status: paymentStatusEnum("status").default("ACTIVE").notNull(),
    externalReference: text("external_reference"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    ...timestamps,
  },
  (table) => [
    index("payment_intents_merchant_created_idx").on(table.merchantId, table.createdAt),
    index("payment_intents_status_expiry_idx").on(table.status, table.expiresAt),
    index("payment_intents_merchant_status_idx").on(table.merchantId, table.status),
    check("payment_intents_amount_positive", sql`${table.amountBaseUnits} > 0`),
  ],
);

export const paymentRecipients = pgTable(
  "payment_recipients",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("rcp")),
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentIntents.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    walletAddress: text("wallet_address").notNull(),
    allocationBps: integer("allocation_bps").notNull(),
    amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_recipients_payment_wallet_uidx").on(
      table.paymentId,
      table.walletAddress,
    ),
    uniqueIndex("payment_recipients_payment_position_uidx").on(
      table.paymentId,
      table.position,
    ),
    index("payment_recipients_payment_idx").on(table.paymentId),
    index("payment_recipients_wallet_idx").on(table.walletAddress),
    check(
      "payment_recipients_allocation_range",
      sql`${table.allocationBps} > 0 AND ${table.allocationBps} <= 10000`,
    ),
    check("payment_recipients_amount_positive", sql`${table.amountBaseUnits} > 0`),
  ],
);

export type ExpectedTransferSnapshot = {
  recipient: string;
  amountBaseUnits: string;
};

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("txn")),
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentIntents.id, { onDelete: "restrict" }),
    payerWallet: text("payer_wallet").notNull(),
    network: text("network").notNull(),
    asset: assetEnum("asset").notNull(),
    referenceAddress: text("reference_address").notNull(),
    abandonTokenHash: text("abandon_token_hash"),
    signature: text("signature"),
    status: transactionStatusEnum("status").default("PREPARED").notNull(),
    expectedTransfers: jsonb("expected_transfers").$type<ExpectedTransferSnapshot[]>().notNull(),
    recentBlockhash: text("recent_blockhash").notNull(),
    lastValidBlockHeight: bigint("last_valid_block_height", { mode: "bigint" }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    verificationAttempts: integer("verification_attempts").default(0).notNull(),
    nextVerificationAt: timestamp("next_verification_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_transactions_reference_uidx").on(table.referenceAddress),
    uniqueIndex("payment_transactions_signature_uidx")
      .on(table.signature)
      .where(sql`${table.signature} IS NOT NULL`),
    uniqueIndex("payment_transactions_unresolved_payment_uidx")
      .on(table.paymentId)
      .where(sql`${table.status} IN ('PREPARED', 'SUBMITTED', 'CONFIRMING')`),
    index("payment_transactions_payment_created_idx").on(table.paymentId, table.createdAt),
    index("payment_transactions_worker_idx").on(table.status, table.nextVerificationAt),
    index("payment_transactions_payer_idx").on(table.payerWallet),
  ],
);

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("rct")),
    paymentId: text("payment_id")
      .notNull()
      .references(() => paymentIntents.id, { onDelete: "restrict" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => paymentTransactions.id, { onDelete: "restrict" }),
    signature: text("signature").notNull(),
    payerWallet: text("payer_wallet").notNull(),
    network: text("network").notNull(),
    slot: bigint("slot", { mode: "bigint" }).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_receipts_payment_uidx").on(table.paymentId),
    uniqueIndex("payment_receipts_transaction_uidx").on(table.transactionId),
    uniqueIndex("payment_receipts_signature_uidx").on(table.signature),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("idem")),
    subject: text("subject").notNull(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idempotency_keys_subject_scope_key_uidx").on(
      table.subject,
      table.scope,
      table.key,
    ),
    index("idempotency_keys_expiry_idx").on(table.expiresAt),
  ],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: text("bucket_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.bucketKey, table.windowStart] }),
    index("rate_limit_buckets_expiry_idx").on(table.expiresAt),
    check("rate_limit_buckets_count_positive", sql`${table.count} > 0`),
  ],
);
