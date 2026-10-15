CREATE TABLE buoy_accounts (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 revision TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_proposals (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('playbook','renewal')), account_revision TEXT NOT NULL,
 snapshot TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','approved')),
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT
);
CREATE TABLE buoy_tasks (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 proposal_id TEXT NOT NULL UNIQUE REFERENCES buoy_proposals(id) ON DELETE CASCADE,
 title TEXT NOT NULL, due_date TEXT NOT NULL, completed_at TEXT, evidence TEXT
);
CREATE TABLE buoy_decisions (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 proposal_id TEXT NOT NULL UNIQUE REFERENCES buoy_proposals(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('renewed','churned','deferred')),
 reason TEXT NOT NULL, evidence TEXT NOT NULL, renewal_date TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE buoy_events (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 actor TEXT NOT NULL, action TEXT NOT NULL, occurred_at TEXT NOT NULL
);
CREATE TABLE buoy_agent_tokens (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE TABLE buoy_assertions (ok INTEGER NOT NULL CHECK(ok=1));
CREATE INDEX buoy_proposals_account ON buoy_proposals(account_id);
CREATE INDEX buoy_tasks_account ON buoy_tasks(account_id);
CREATE INDEX buoy_decisions_account ON buoy_decisions(account_id);
