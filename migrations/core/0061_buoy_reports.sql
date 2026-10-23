CREATE TABLE buoy_reports (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 revision TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_dashboards (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 revision TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_dashboard_reports (
 dashboard_id TEXT NOT NULL REFERENCES buoy_dashboards(id) ON DELETE CASCADE,
 report_id TEXT NOT NULL REFERENCES buoy_reports(id) ON DELETE CASCADE,
 position INTEGER NOT NULL, PRIMARY KEY(dashboard_id,report_id)
);
CREATE TABLE buoy_report_accounts (
 report_id TEXT NOT NULL REFERENCES buoy_reports(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(report_id,account_id)
);
CREATE TRIGGER buoy_report_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_reports WHERE id IN (SELECT report_id FROM buoy_report_accounts WHERE account_id=OLD.id);
END;
-- Explicit view authority is installation-local, like ROLE-001 assignments.
CREATE TABLE buoy_report_shares (
 report_id TEXT NOT NULL REFERENCES buoy_reports(id) ON DELETE CASCADE,
 role_id TEXT NOT NULL, PRIMARY KEY(report_id,role_id)
);
CREATE TABLE buoy_dashboard_shares (
 dashboard_id TEXT NOT NULL REFERENCES buoy_dashboards(id) ON DELETE CASCADE,
 role_id TEXT NOT NULL, PRIMARY KEY(dashboard_id,role_id)
);
