-- DATA-001: owner/admin settings such as per-source staleness thresholds.
CREATE TABLE buoy_settings (
 key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)),
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
