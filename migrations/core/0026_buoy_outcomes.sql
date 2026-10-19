-- PLAY-004: frozen observational cohorts, first observed outcomes.
CREATE TABLE buoy_outcomes (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 started_at TEXT NOT NULL, deadline TEXT NOT NULL, created_by TEXT NOT NULL,
 operation_key TEXT NOT NULL UNIQUE, closed_at TEXT
);
CREATE TABLE buoy_outcome_accounts (
 report_id TEXT NOT NULL REFERENCES buoy_outcomes(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 task_id TEXT, cohort TEXT NOT NULL CHECK(cohort IN ('enrolled','comparison')),
 baseline_revision TEXT NOT NULL, reached_at TEXT, evidence TEXT,
 PRIMARY KEY(report_id,account_id)
);
