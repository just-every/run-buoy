-- Confirmed recurring terms are separate from invoice/receivables snapshots.
-- One current version per account; replaced documents remain source history.
CREATE TABLE buoy_recurring_contract_versions (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 revision TEXT NOT NULL UNIQUE,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('person-confirmed','billing','crm','warehouse','file')),
 document TEXT NOT NULL CHECK(json_valid(document)),
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 UNIQUE(account_id,id)
);
CREATE TABLE buoy_recurring_contract_current (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL,
 FOREIGN KEY(account_id,version_id) REFERENCES buoy_recurring_contract_versions(account_id,id) ON DELETE CASCADE
);
CREATE INDEX buoy_recurring_contract_history ON buoy_recurring_contract_versions(account_id,recorded_at,id);
CREATE TRIGGER buoy_recurring_contract_immutable_update BEFORE UPDATE ON buoy_recurring_contract_versions BEGIN
 SELECT RAISE(ABORT,'Recurring contract versions are immutable');
END;
-- Permit the account's erasure cascade, but never delete retained source history.
CREATE TRIGGER buoy_recurring_contract_immutable_delete BEFORE DELETE ON buoy_recurring_contract_versions
 WHEN EXISTS(SELECT 1 FROM buoy_accounts WHERE id=OLD.account_id) BEGIN
 SELECT RAISE(ABORT,'Recurring contract versions are immutable');
END;
