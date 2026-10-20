-- ADOPT-001: global event-set definitions and explicit account seat denominators.
CREATE TABLE buoy_adoption_definitions (
 kind TEXT NOT NULL CHECK(kind IN ('feature','module')), key TEXT NOT NULL,
 name TEXT NOT NULL, events TEXT NOT NULL CHECK(json_valid(events) AND json_type(events)='array'),
 updated_at TEXT NOT NULL, PRIMARY KEY(kind,key)
);
CREATE TABLE buoy_adoption_seats (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 seats INTEGER NOT NULL CHECK(seats>=0), source_system TEXT NOT NULL CHECK(source_system='manual'),
 reference TEXT NOT NULL, observed_at TEXT NOT NULL,
 stale_days INTEGER NOT NULL CHECK(stale_days BETWEEN 1 AND 365), updated_at TEXT NOT NULL
);
CREATE TABLE buoy_adoption_seat_history (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document)), recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_adoption_seat_history_account ON buoy_adoption_seat_history(account_id,recorded_at,id);
CREATE INDEX buoy_usage_events_observed ON buoy_usage_events(observed_at);
