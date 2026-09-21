CREATE TABLE saved_recipients (
 id TEXT PRIMARY KEY NOT NULL, owner_wallet TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80), address TEXT NOT NULL COLLATE BINARY,
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=200), revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE UNIQUE INDEX saved_recipients_owner_address ON saved_recipients(owner_wallet,address) WHERE deleted_at IS NULL;
CREATE INDEX saved_recipients_owner_created ON saved_recipients(owner_wallet,created_at);
CREATE TABLE saved_recipient_authorizations (nonce TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL);
