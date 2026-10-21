CREATE TABLE buoy_renewal_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL
);
INSERT INTO buoy_renewal_settings VALUES(1,'{"leadDays":90,"stages":["Upcoming","Discovery","Negotiation","Decision"]}','initial');
CREATE TABLE buoy_renewals (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 period_key TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(account_id,period_key)
);
CREATE TABLE buoy_renewal_fields (
 key TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL
);
CREATE TABLE buoy_renewal_values (
 record_id TEXT PRIMARY KEY REFERENCES buoy_renewals(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_renewal_results (
 record_id TEXT PRIMARY KEY REFERENCES buoy_renewals(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_renewal_history (
 id TEXT PRIMARY KEY, record_id TEXT NOT NULL REFERENCES buoy_renewals(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL, old_value TEXT NOT NULL CHECK(json_valid(old_value)), new_value TEXT NOT NULL CHECK(json_valid(new_value)),
 actor TEXT NOT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL
);
ALTER TABLE buoy_tasks ADD COLUMN renewal_id TEXT REFERENCES buoy_renewals(id) ON DELETE CASCADE;
