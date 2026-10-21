-- Weighted health retains the exact input image used for every changed result.
CREATE TABLE buoy_scorecard_versions (
 id TEXT PRIMARY KEY, revision TEXT NOT NULL UNIQUE,
 document TEXT NOT NULL CHECK(json_valid(document)),
 published_by TEXT NOT NULL, published_at TEXT NOT NULL
);
CREATE TRIGGER buoy_scorecard_version_immutable_update BEFORE UPDATE ON buoy_scorecard_versions BEGIN
 SELECT RAISE(ABORT,'Scorecard versions are immutable');
END;
CREATE TRIGGER buoy_scorecard_version_immutable_delete BEFORE DELETE ON buoy_scorecard_versions BEGIN
 SELECT RAISE(ABORT,'Scorecard versions are immutable');
END;
CREATE TABLE buoy_scorecard_current (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision TEXT NOT NULL,
 version_id TEXT NOT NULL REFERENCES buoy_scorecard_versions(id)
);
CREATE TABLE buoy_scorecard_results (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES buoy_scorecard_versions(id),
 input_key TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 calculated_at TEXT NOT NULL
);
CREATE TABLE buoy_scorecard_history (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES buoy_scorecard_versions(id),
 input_key TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 calculated_at TEXT NOT NULL
);
CREATE INDEX buoy_scorecard_history_account ON buoy_scorecard_history(account_id,calculated_at,id);
