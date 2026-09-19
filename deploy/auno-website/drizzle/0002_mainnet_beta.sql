ALTER TABLE payments ADD COLUMN network text NOT NULL DEFAULT 'devnet';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS merchant_network_created_idx ON payments (merchant_wallet,network,created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_attempt_status_updated_idx ON payment_attempts (status,updated_at);
