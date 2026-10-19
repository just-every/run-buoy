-- TEAM-001: owner-managed books, explicit reviewed assignment and handovers.
CREATE TABLE buoy_team_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), document TEXT NOT NULL CHECK(json_valid(document))
);
INSERT INTO buoy_team_settings VALUES(1,'{"teams":[],"capacities":[],"rules":[]}');
CREATE TABLE buoy_account_territories (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 territory TEXT NOT NULL
);
CREATE TABLE buoy_handovers (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 from_id TEXT, to_id TEXT NOT NULL, note TEXT NOT NULL, actor_id TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_handovers_account ON buoy_handovers(account_id,recorded_at);
