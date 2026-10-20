-- USAGE-001: only exact, explicitly reviewed source claims may be attributed.
CREATE TABLE buoy_usage_mappings (
 source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 claim_key TEXT NOT NULL, user_id TEXT, group_id TEXT,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 revision TEXT NOT NULL, reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL,
 PRIMARY KEY(source_id,claim_key)
);
CREATE INDEX buoy_usage_mappings_account ON buoy_usage_mappings(account_id);
CREATE TRIGGER buoy_usage_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_usage_events WHERE EXISTS(
  SELECT 1 FROM buoy_usage_mappings m WHERE m.source_id=buoy_usage_events.source_id
   AND m.user_id IS buoy_usage_events.user_id AND m.group_id IS buoy_usage_events.group_id AND m.account_id=OLD.id
 );
END;
-- Cascading customer deletion and account erasure retire raw mapped custody
-- regardless of the order in which account BEFORE DELETE triggers run.
CREATE TRIGGER buoy_usage_mapping_erasure BEFORE DELETE ON buoy_usage_mappings BEGIN
 DELETE FROM buoy_usage_events WHERE source_id=OLD.source_id
  AND user_id IS OLD.user_id AND group_id IS OLD.group_id;
END;
