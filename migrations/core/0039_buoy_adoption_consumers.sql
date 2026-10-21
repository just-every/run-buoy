-- ADOPT-001: configurable health measures and owner-routed alert episodes.
CREATE TABLE buoy_adoption_consumers (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 revision TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE buoy_adoption_alert_state (
 rule_id TEXT NOT NULL REFERENCES buoy_adoption_consumers(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL, episode TEXT NOT NULL,
 active INTEGER NOT NULL CHECK(active IN (0,1)),
 PRIMARY KEY(rule_id,account_id,person_id)
);
CREATE INDEX buoy_adoption_alert_account ON buoy_adoption_alert_state(account_id);
