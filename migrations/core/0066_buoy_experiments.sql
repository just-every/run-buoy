CREATE TABLE buoy_experiments (
 id TEXT PRIMARY KEY, operation_key TEXT NOT NULL UNIQUE, request TEXT NOT NULL,
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('proposed','approved')), proposed_at TEXT NOT NULL,
 prepared_by TEXT NOT NULL, approved_by TEXT, approved_at TEXT, approval_reference TEXT,
 health_report_id TEXT REFERENCES buoy_outcomes(id), renewal_report_id TEXT REFERENCES buoy_outcomes(id),
 playbook_id TEXT REFERENCES buoy_playbooks(id)
);
CREATE TABLE buoy_experiment_accounts (
 experiment_id TEXT NOT NULL REFERENCES buoy_experiments(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 pair_index INTEGER NOT NULL, cohort TEXT NOT NULL CHECK(cohort IN('enrolled','comparison')),
 baseline TEXT NOT NULL CHECK(json_valid(baseline)), run_id TEXT REFERENCES buoy_playbook_runs(id) ON DELETE SET NULL,
 PRIMARY KEY(experiment_id,account_id), UNIQUE(experiment_id,pair_index,cohort)
);
-- Preserve the existing ledger while extending its allowed command vocabulary.
ALTER TABLE buoy_agent_ledger RENAME TO buoy_agent_ledger_before_experiments;
CREATE TABLE buoy_agent_ledger (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, token_id TEXT NOT NULL,
 command TEXT NOT NULL CHECK(command IN ('renewals.list','playbook.prepare','renewal.prepare','experiment.prepare','experiment.report','commands.read','commands.request','other.route')),
 status TEXT NOT NULL CHECK(status IN ('attempt','succeeded','refused')), reason TEXT NOT NULL,
 spent_minor INTEGER NOT NULL DEFAULT 0 CHECK(spent_minor>=0), occurred_at TEXT NOT NULL
);
INSERT INTO buoy_agent_ledger SELECT * FROM buoy_agent_ledger_before_experiments;
DROP TABLE buoy_agent_ledger_before_experiments;
CREATE INDEX buoy_agent_ledger_time ON buoy_agent_ledger(occurred_at DESC,id);
