CREATE TABLE buoy_playbooks (
 id TEXT PRIMARY KEY, revision TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), published_at TEXT NOT NULL
);
CREATE TABLE buoy_playbook_versions (
 id TEXT PRIMARY KEY, playbook_id TEXT NOT NULL REFERENCES buoy_playbooks(id),
 document TEXT NOT NULL CHECK(json_valid(document)), published_by TEXT NOT NULL, published_at TEXT NOT NULL
);
CREATE TABLE buoy_playbook_runs (
 id TEXT PRIMARY KEY, playbook_id TEXT NOT NULL REFERENCES buoy_playbooks(id),
 version_id TEXT NOT NULL REFERENCES buoy_playbook_versions(id),
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 entry_key TEXT NOT NULL, owner_id TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL CHECK(status IN('running','waiting','approval','receipt','failed','completed','exited')),
 revision TEXT NOT NULL, account_revision TEXT NOT NULL,
 started_at TEXT NOT NULL, updated_at TEXT NOT NULL, due_at TEXT, error TEXT,
 UNIQUE(playbook_id,account_id,entry_key)
);
CREATE UNIQUE INDEX buoy_playbook_active ON buoy_playbook_runs(playbook_id,account_id)
 WHERE status NOT IN('completed','exited');
CREATE TABLE buoy_playbook_events (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES buoy_playbook_runs(id) ON DELETE CASCADE,
 step_index INTEGER NOT NULL, attempt INTEGER NOT NULL, status TEXT NOT NULL,
 inputs TEXT NOT NULL CHECK(json_valid(inputs)), result TEXT NOT NULL CHECK(json_valid(result)), recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_playbook_event_run ON buoy_playbook_events(run_id,step_index,recorded_at,id);
CREATE TABLE buoy_playbook_proposals (
 run_id TEXT NOT NULL REFERENCES buoy_playbook_runs(id) ON DELETE CASCADE,
 step_index INTEGER NOT NULL, proposal_id TEXT NOT NULL UNIQUE REFERENCES buoy_proposals(id) ON DELETE CASCADE,
 PRIMARY KEY(run_id,step_index)
);
CREATE TABLE buoy_playbook_triggers (
 playbook_id TEXT NOT NULL REFERENCES buoy_playbooks(id),
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 matching INTEGER NOT NULL CHECK(matching IN(0,1)), interval_id TEXT NOT NULL,
 PRIMARY KEY(playbook_id,account_id)
);
CREATE TABLE buoy_playbook_alerts (
 version_id TEXT PRIMARY KEY REFERENCES buoy_playbook_versions(id),
 episode INTEGER NOT NULL DEFAULT 0, opened INTEGER NOT NULL DEFAULT 0 CHECK(opened IN(0,1))
);
ALTER TABLE buoy_outcome_accounts ADD COLUMN run_id TEXT REFERENCES buoy_playbook_runs(id) ON DELETE SET NULL;
ALTER TABLE buoy_playbook_runs ADD COLUMN checked_at TEXT;
