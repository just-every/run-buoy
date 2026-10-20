-- Existing credentials retain their current read/preparation authority and expiry.
ALTER TABLE buoy_agent_tokens ADD COLUMN scopes TEXT NOT NULL DEFAULT '["renewals.list","playbook.prepare","renewal.prepare"]' CHECK(json_valid(scopes));
ALTER TABLE buoy_agent_tokens ADD COLUMN data_classes TEXT NOT NULL DEFAULT '["account","billing","support","sentiment"]' CHECK(json_valid(data_classes));
ALTER TABLE buoy_agent_tokens ADD COLUMN requests_per_minute INTEGER NOT NULL DEFAULT 60 CHECK(requests_per_minute BETWEEN 1 AND 10000);
ALTER TABLE buoy_agent_tokens ADD COLUMN budget_minor INTEGER NOT NULL DEFAULT 0 CHECK(budget_minor BETWEEN 0 AND 9007199254740991);
CREATE TABLE buoy_agent_settings (singleton INTEGER PRIMARY KEY CHECK(singleton=1), disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)));
INSERT INTO buoy_agent_settings(singleton,disabled) VALUES(1,0);
CREATE TABLE buoy_agent_minutes (
 token_id TEXT NOT NULL, minute INTEGER NOT NULL, requests INTEGER NOT NULL CHECK(requests>0),
 PRIMARY KEY(token_id,minute)
);
-- No account/body/name/evidence or credential is retained. Rows survive revocation.
CREATE TABLE buoy_agent_ledger (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, token_id TEXT NOT NULL,
 command TEXT NOT NULL CHECK(command IN ('renewals.list','playbook.prepare','renewal.prepare','commands.read','commands.request','other.route')),
 status TEXT NOT NULL CHECK(status IN ('attempt','succeeded','refused')), reason TEXT NOT NULL,
 spent_minor INTEGER NOT NULL DEFAULT 0 CHECK(spent_minor>=0), occurred_at TEXT NOT NULL
);
CREATE INDEX buoy_agent_ledger_time ON buoy_agent_ledger(occurred_at DESC,id);
