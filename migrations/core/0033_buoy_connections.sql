CREATE TABLE buoy_connections (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider='stripe'),
 creator_id TEXT NOT NULL, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 disconnected_at TEXT, cursor TEXT, last_success TEXT, last_error TEXT,
 stale_days INTEGER NOT NULL DEFAULT 30 CHECK(stale_days BETWEEN 1 AND 365),
 lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE buoy_connection_credentials (connection_id TEXT PRIMARY KEY, sealed TEXT NOT NULL);
CREATE TABLE buoy_connection_records (
 connection_id TEXT NOT NULL REFERENCES buoy_connections(id), source_id TEXT NOT NULL,
 observed_at TEXT NOT NULL, PRIMARY KEY(connection_id,source_id)
);
CREATE TABLE buoy_connection_runs (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES buoy_connections(id),
 started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
 read_count INTEGER NOT NULL DEFAULT 0, added_count INTEGER NOT NULL DEFAULT 0,
 cursor_before TEXT, cursor_after TEXT, error TEXT
);
