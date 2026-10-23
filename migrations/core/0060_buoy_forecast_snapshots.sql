CREATE TABLE buoy_forecast_snapshots (
 id TEXT PRIMARY KEY, week_start TEXT NOT NULL UNIQUE, captured_at TEXT NOT NULL, evaluation_day TEXT NOT NULL
);
CREATE TABLE buoy_forecast_snapshot_items (
 snapshot_id TEXT NOT NULL REFERENCES buoy_forecast_snapshots(id) ON DELETE CASCADE,
 renewal_id TEXT NOT NULL REFERENCES buoy_renewals(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document)),
 PRIMARY KEY(snapshot_id,renewal_id)
);
