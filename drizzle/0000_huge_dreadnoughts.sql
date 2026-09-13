CREATE TYPE "public"."asset" AS ENUM('SOL', 'USDC');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('DRAFT', 'ACTIVE', 'AWAITING_SIGNATURE', 'SUBMITTED', 'CONFIRMING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PREPARED', 'SUBMITTED', 'CONFIRMING', 'VERIFIED', 'FAILED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"nonce" text NOT NULL,
	"message" text NOT NULL,
	"domain" text NOT NULL,
	"uri" text NOT NULL,
	"chain_id" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"merchant_wallet" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"asset" "asset" NOT NULL,
	"amount_display" text NOT NULL,
	"amount_base_units" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'ACTIVE' NOT NULL,
	"external_reference" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_amount_positive" CHECK ("payment_intents"."amount_base_units" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"signature" text NOT NULL,
	"payer_wallet" text NOT NULL,
	"network" text NOT NULL,
	"slot" bigint NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"position" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"allocation_bps" integer NOT NULL,
	"amount_base_units" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_recipients_allocation_range" CHECK ("payment_recipients"."allocation_bps" > 0 AND "payment_recipients"."allocation_bps" <= 10000),
	CONSTRAINT "payment_recipients_amount_positive" CHECK ("payment_recipients"."amount_base_units" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"payer_wallet" text NOT NULL,
	"network" text NOT NULL,
	"asset" "asset" NOT NULL,
	"reference_address" text NOT NULL,
	"signature" text,
	"status" "transaction_status" DEFAULT 'PREPARED' NOT NULL,
	"expected_transfers" jsonb NOT NULL,
	"recent_blockhash" text NOT NULL,
	"last_valid_block_height" bigint NOT NULL,
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"failure_code" text,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"next_verification_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"bucket_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_bucket_key_window_start_pk" PRIMARY KEY("bucket_key","window_start"),
	CONSTRAINT "rate_limit_buckets_count_positive" CHECK ("rate_limit_buckets"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_payment_intents_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_recipients" ADD CONSTRAINT "payment_recipients_payment_id_payment_intents_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payment_intents_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_challenges_nonce_uidx" ON "auth_challenges" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "auth_challenges_wallet_idx" ON "auth_challenges" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "auth_challenges_expiry_idx" ON "auth_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_subject_scope_key_uidx" ON "idempotency_keys" USING btree ("subject","scope","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_wallet_address_uidx" ON "merchants" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "payment_intents_merchant_created_idx" ON "payment_intents" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_intents_status_expiry_idx" ON "payment_intents" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "payment_intents_merchant_status_idx" ON "payment_intents" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_payment_uidx" ON "payment_receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_transaction_uidx" ON "payment_receipts" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_signature_uidx" ON "payment_receipts" USING btree ("signature");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_recipients_payment_wallet_uidx" ON "payment_recipients" USING btree ("payment_id","wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_recipients_payment_position_uidx" ON "payment_recipients" USING btree ("payment_id","position");--> statement-breakpoint
CREATE INDEX "payment_recipients_payment_idx" ON "payment_recipients" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_recipients_wallet_idx" ON "payment_recipients" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_reference_uidx" ON "payment_transactions" USING btree ("reference_address");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_signature_uidx" ON "payment_transactions" USING btree ("signature") WHERE "payment_transactions"."signature" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_unresolved_payment_uidx" ON "payment_transactions" USING btree ("payment_id") WHERE "payment_transactions"."status" IN ('PREPARED', 'SUBMITTED', 'CONFIRMING');--> statement-breakpoint
CREATE INDEX "payment_transactions_payment_created_idx" ON "payment_transactions" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_transactions_worker_idx" ON "payment_transactions" USING btree ("status","next_verification_at");--> statement-breakpoint
CREATE INDEX "payment_transactions_payer_idx" ON "payment_transactions" USING btree ("payer_wallet");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uidx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_merchant_idx" ON "sessions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");