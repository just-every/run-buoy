CREATE TABLE buoy_ai_schedules(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 question TEXT NOT NULL,
 hour_utc INTEGER NOT NULL CHECK(hour_utc BETWEEN 0 AND 23),
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL,
 policy_revision TEXT NOT NULL,
 policy_document TEXT NOT NULL,
 revision TEXT NOT NULL,
 revoked_at TEXT,
 last_slot TEXT
);
