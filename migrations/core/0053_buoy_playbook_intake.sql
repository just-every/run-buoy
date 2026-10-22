CREATE TABLE buoy_playbook_credentials (
 id TEXT PRIMARY KEY, playbook_id TEXT NOT NULL REFERENCES buoy_playbooks(id), version_id TEXT NOT NULL,
 digest TEXT NOT NULL UNIQUE, account_ids TEXT NOT NULL CHECK(json_valid(account_ids)),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT, last_used_at TEXT
);
CREATE TABLE buoy_playbook_intake_limits (
 credential_id TEXT NOT NULL REFERENCES buoy_playbook_credentials(id) ON DELETE CASCADE,
 minute INTEGER NOT NULL, requests INTEGER NOT NULL,
 PRIMARY KEY(credential_id,minute)
);
