-- Reviewed data-trust work retains evidence, never execution authority.
CREATE TABLE buoy_trust_proposals (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 related_account_id TEXT REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('duplicate','arr','stale','mapping')),
 evidence TEXT NOT NULL CHECK(json_valid(evidence)),
 fingerprint TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('prepared','approved','rejected')),
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 reviewed_by TEXT, reviewed_at TEXT, reason TEXT,
 UNIQUE(fingerprint)
);
CREATE INDEX buoy_trust_account ON buoy_trust_proposals(account_id,status);
