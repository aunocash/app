CREATE TABLE IF NOT EXISTS `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`payer` text NOT NULL,
	`message` text NOT NULL,
	`transaction` text NOT NULL,
	`last_valid_block_height` integer NOT NULL,
	`created_at` integer NOT NULL,
	`signature` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attempt_payment_idx` ON `attempts` (`payment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`merchant_wallet` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`asset` text NOT NULL,
	`amount` text NOT NULL,
	`amount_base_units` text NOT NULL,
	`recipients` text NOT NULL,
	`reference` text NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`transaction_signature` text,
	`payer` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`paid_at` integer,
	`creation_key` text NOT NULL,
	`active_attempt` text,
	`lease_until` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `merchant_created_idx` ON `payments` (`merchant_wallet`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `creation_key_idx` ON `payments` (`creation_key`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `signature_unique_idx` ON `payments` (`transaction_signature`);
