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
 actor TEXT NOT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_field_history_account ON buoy_field_history(account_id,recorded_at);
