-- Integration authority never travels with an installation archive.
CREATE TABLE buoy_integration_tokens (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL,
 scopes TEXT NOT NULL,
 account_ids TEXT NOT NULL,
 requests_per_minute INTEGER NOT NULL CHECK(requests_per_minute BETWEEN 1 AND 600),
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 last_used_at TEXT
);
CREATE TABLE buoy_integration_minutes (
 token_id TEXT NOT NULL REFERENCES buoy_integration_tokens(id) ON DELETE CASCADE,
 minute INTEGER NOT NULL,
 requests INTEGER NOT NULL,
 PRIMARY KEY(token_id,minute)
);
-- No request bytes or account snapshots are retained. Erasure removes receipts.
CREATE TABLE buoy_integration_receipts (
 token_id TEXT NOT NULL REFERENCES buoy_integration_tokens(id) ON DELETE CASCADE,
 key_hash TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 revision TEXT NOT NULL,
 status INTEGER NOT NULL,
 PRIMARY KEY(token_id,key_hash)
);
