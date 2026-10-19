-- HEALTH-002: CSM sentiment is a person's dated judgment, kept as history.
-- The newest rating per account feeds health until its expiry date.
CREATE TABLE buoy_sentiments (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 rating TEXT NOT NULL CHECK(rating IN ('red','amber','green')), reason TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, expires_on TEXT NOT NULL
);
CREATE INDEX buoy_sentiments_account ON buoy_sentiments(account_id, recorded_at);
