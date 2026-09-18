CREATE TABLE IF NOT EXISTS `payment_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `payment_id` text NOT NULL,
  `payer` text NOT NULL,
  `message_hash` text NOT NULL,
  `attempt_token_hash` text NOT NULL,
  `last_valid_block_height` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `signature` text,
  `status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_attempt_payment_created_idx` ON `payment_attempts` (`payment_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payment_attempt_signature_idx` ON `payment_attempts` (`signature`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_rate_limits` (
  `bucket` text PRIMARY KEY NOT NULL,
  `window_started_at` integer NOT NULL,
  `count` integer NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `payments_recipients_insert_guard`
BEFORE INSERT ON `payments`
FOR EACH ROW BEGIN
  SELECT CASE WHEN json_valid(NEW.recipients) = 0 THEN RAISE(ABORT, 'invalid recipient JSON') END;
  SELECT CASE WHEN json_array_length(NEW.recipients) < 1 OR json_array_length(NEW.recipients) > 5 THEN RAISE(ABORT, 'invalid recipient count') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM json_each(NEW.recipients) WHERE CAST(json_extract(value,'$.position') AS INTEGER) != CAST(key AS INTEGER)) > 0 THEN RAISE(ABORT, 'recipient positions must be contiguous') END;
  SELECT CASE WHEN (SELECT COUNT(DISTINCT json_extract(value,'$.address')) FROM json_each(NEW.recipients)) != json_array_length(NEW.recipients) THEN RAISE(ABORT, 'recipient wallets must be unique') END;
  SELECT CASE WHEN (SELECT SUM(CAST(json_extract(value,'$.percentageBps') AS INTEGER)) FROM json_each(NEW.recipients)) != 10000 THEN RAISE(ABORT, 'recipient allocation must total 10000 bps') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM json_each(NEW.recipients) WHERE CAST(json_extract(value,'$.amountBaseUnits') AS INTEGER) <= 0) > 0 THEN RAISE(ABORT, 'recipient allocation cannot be zero') END;
  SELECT CASE WHEN (SELECT SUM(CAST(json_extract(value,'$.amountBaseUnits') AS INTEGER)) FROM json_each(NEW.recipients)) != CAST(NEW.amount_base_units AS INTEGER) THEN RAISE(ABORT, 'recipient allocations must equal payment amount') END;
  SELECT CASE WHEN json_array_length(NEW.recipients) = 1 AND (SELECT CAST(json_extract(value,'$.percentageBps') AS INTEGER) FROM json_each(NEW.recipients) LIMIT 1) != 10000 THEN RAISE(ABORT, 'single recipient must receive 10000 bps') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `payments_recipients_update_guard`
BEFORE UPDATE OF `recipients`, `amount_base_units` ON `payments`
FOR EACH ROW BEGIN
  SELECT CASE WHEN json_valid(NEW.recipients) = 0 THEN RAISE(ABORT, 'invalid recipient JSON') END;
  SELECT CASE WHEN json_array_length(NEW.recipients) < 1 OR json_array_length(NEW.recipients) > 5 THEN RAISE(ABORT, 'invalid recipient count') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM json_each(NEW.recipients) WHERE CAST(json_extract(value,'$.position') AS INTEGER) != CAST(key AS INTEGER)) > 0 THEN RAISE(ABORT, 'recipient positions must be contiguous') END;
  SELECT CASE WHEN (SELECT COUNT(DISTINCT json_extract(value,'$.address')) FROM json_each(NEW.recipients)) != json_array_length(NEW.recipients) THEN RAISE(ABORT, 'recipient wallets must be unique') END;
  SELECT CASE WHEN (SELECT SUM(CAST(json_extract(value,'$.percentageBps') AS INTEGER)) FROM json_each(NEW.recipients)) != 10000 THEN RAISE(ABORT, 'recipient allocation must total 10000 bps') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM json_each(NEW.recipients) WHERE CAST(json_extract(value,'$.amountBaseUnits') AS INTEGER) <= 0) > 0 THEN RAISE(ABORT, 'recipient allocation cannot be zero') END;
  SELECT CASE WHEN (SELECT SUM(CAST(json_extract(value,'$.amountBaseUnits') AS INTEGER)) FROM json_each(NEW.recipients)) != CAST(NEW.amount_base_units AS INTEGER) THEN RAISE(ABORT, 'recipient allocations must equal payment amount') END;
END;
