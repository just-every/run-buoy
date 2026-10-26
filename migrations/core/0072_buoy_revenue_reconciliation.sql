CREATE TABLE buoy_revenue_resolutions (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 account_revision TEXT NOT NULL,
 contract_version_id TEXT NOT NULL,
 contract_revision TEXT NOT NULL,
 billing_snapshot_id TEXT NOT NULL,
 resolved_by TEXT NOT NULL,
 resolved_at TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 UNIQUE(account_id,contract_version_id,contract_revision,billing_snapshot_id)
);
CREATE TRIGGER buoy_revenue_resolution_immutable BEFORE UPDATE ON buoy_revenue_resolutions BEGIN
 SELECT RAISE(ABORT,'Revenue resolutions are immutable');
END;
CREATE TRIGGER buoy_revenue_resolution_delete BEFORE DELETE ON buoy_revenue_resolutions
 WHEN EXISTS(SELECT 1 FROM buoy_accounts WHERE id=OLD.account_id) BEGIN
 SELECT RAISE(ABORT,'Revenue resolutions are immutable');
END;
