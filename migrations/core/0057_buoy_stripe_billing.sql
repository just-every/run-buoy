-- Stripe test-mode observations belong only to an explicitly reviewed existing account.
CREATE TABLE buoy_billing_bindings (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES buoy_connections(id),
 customer_id TEXT NOT NULL, account_id TEXT NOT NULL UNIQUE REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 revision TEXT NOT NULL UNIQUE, reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL,
 UNIQUE(connection_id,customer_id), UNIQUE(id,account_id)
);
CREATE TABLE buoy_billing_settings (
 connection_id TEXT PRIMARY KEY REFERENCES buoy_connections(id),
 stale_days INTEGER NOT NULL DEFAULT 30 CHECK(stale_days BETWEEN 1 AND 365),
 version INTEGER NOT NULL DEFAULT 1, cursor TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 last_success TEXT, last_error TEXT
);
CREATE TABLE buoy_billing_webhook_credentials (connection_id TEXT PRIMARY KEY, sealed TEXT NOT NULL);
CREATE TABLE buoy_billing_runs (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES buoy_connections(id),
 customer_id TEXT, started_at TEXT NOT NULL, finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
 read_count INTEGER NOT NULL DEFAULT 0, snapshot_count INTEGER NOT NULL DEFAULT 0,
 cursor_before TEXT, cursor_after TEXT, error TEXT, trigger_kind TEXT NOT NULL
);
CREATE TABLE buoy_billing_snapshots (
 id TEXT PRIMARY KEY, binding_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES buoy_connections(id), customer_id TEXT NOT NULL,
 source_system TEXT NOT NULL CHECK(source_system='stripe-test'), source_reference TEXT NOT NULL,
 observed_at TEXT NOT NULL, received_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 account_revision TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES buoy_billing_runs(id),
 UNIQUE(account_id,id)
);
CREATE TABLE buoy_billing_current (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 snapshot_id TEXT NOT NULL,
 FOREIGN KEY(account_id,snapshot_id) REFERENCES buoy_billing_snapshots(account_id,id) ON DELETE CASCADE
);
CREATE TABLE buoy_billing_changes (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 snapshot_id TEXT NOT NULL REFERENCES buoy_billing_snapshots(id) ON DELETE CASCADE,
 source_reference TEXT NOT NULL, observed_at TEXT NOT NULL,
 before_document TEXT CHECK(before_document IS NULL OR json_valid(before_document)),
 after_document TEXT NOT NULL CHECK(json_valid(after_document))
);
CREATE TABLE buoy_billing_webhook_events (
 connection_id TEXT NOT NULL REFERENCES buoy_connections(id), event_id TEXT NOT NULL,
 event_type TEXT NOT NULL, payload_digest TEXT NOT NULL, received_at TEXT NOT NULL,
 customer_id TEXT, status TEXT NOT NULL CHECK(status IN ('pending','processed','ignored')),
 processed_at TEXT, PRIMARY KEY(connection_id,event_id)
);
CREATE INDEX buoy_billing_snapshot_history ON buoy_billing_snapshots(account_id,observed_at,id);
CREATE TRIGGER buoy_billing_snapshot_immutable BEFORE UPDATE ON buoy_billing_snapshots BEGIN
 SELECT RAISE(ABORT,'Billing observations are immutable');
END;
CREATE TRIGGER buoy_billing_snapshot_delete BEFORE DELETE ON buoy_billing_snapshots
 WHEN EXISTS(SELECT 1 FROM buoy_accounts WHERE id=OLD.account_id) BEGIN
 SELECT RAISE(ABORT,'Billing observations are immutable');
END;
