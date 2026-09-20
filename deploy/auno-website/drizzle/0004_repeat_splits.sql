CREATE TABLE repeat_splits (
 id TEXT PRIMARY KEY NOT NULL, network TEXT NOT NULL, owner_wallet TEXT NOT NULL,
 name TEXT NOT NULL, description TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL,
 allocation_type TEXT NOT NULL DEFAULT 'percentage', recipients TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 last_used_at INTEGER, execution_count INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER
);
CREATE INDEX repeat_splits_owner_network ON repeat_splits(owner_wallet, network, created_at);
CREATE TABLE repeat_split_authorizations (nonce TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL);
ALTER TABLE payments ADD COLUMN repeat_split_id TEXT;
ALTER TABLE payments ADD COLUMN repeat_split_name TEXT;
CREATE INDEX payments_repeat_split ON payments(repeat_split_id);
-- Count once, atomically with the existing finalized-payment update. Failed,
-- pending and re-verified payments never count. Template deletion keeps history.
CREATE TRIGGER repeat_split_finalized AFTER UPDATE OF status ON payments
WHEN NEW.status='PAID' AND OLD.status!='PAID'
 AND NEW.repeat_split_id IS NOT NULL AND NEW.transaction_signature IS NOT NULL
 AND NEW.paid_at IS NOT NULL AND NEW.payer=NEW.merchant_wallet
BEGIN
 UPDATE repeat_splits SET execution_count=execution_count+1,
 last_used_at=MAX(COALESCE(last_used_at,0), NEW.paid_at)
 WHERE id=NEW.repeat_split_id AND owner_wallet=NEW.payer AND network=NEW.network;
END;
