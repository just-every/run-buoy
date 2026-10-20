-- ACCOUNT-004: portable field definitions, native values and account-owned history.
CREATE TABLE buoy_fields (
 key TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL
);
CREATE TABLE buoy_field_values (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_field_results (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_field_history (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL, old_value TEXT NOT NULL, new_value TEXT NOT NULL,
 source_account_id TEXT REFERENCES buoy_accounts(id) ON DELETE SET NULL,
 actor TEXT NOT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_field_history_account ON buoy_field_history(account_id,recorded_at);

-- ERASE-001: a portfolio calculation can cite another account's input. Keep
-- that lineage until erasure, then redact its source details in the same delete.
CREATE TRIGGER buoy_field_source_erasure BEFORE DELETE ON buoy_accounts BEGIN
 UPDATE buoy_field_history SET source='Calculated input source erased',source_account_id=NULL
 WHERE source_account_id=OLD.id AND account_id<>OLD.id;
END;
