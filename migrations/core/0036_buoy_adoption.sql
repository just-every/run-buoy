-- ADOPT-001: global event-set definitions and explicit account seat denominators.
CREATE TABLE buoy_adoption_definitions (
 kind TEXT NOT NULL CHECK(kind IN ('feature','module')), key TEXT NOT NULL,
 name TEXT NOT NULL, events TEXT NOT NULL CHECK(json_valid(events) AND json_type(events)='array'),
 updated_at TEXT NOT NULL, PRIMARY KEY(kind,key)
);
CREATE TABLE buoy_adoption_seats (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 seats INTEGER NOT NULL CHECK(seats>=0), updated_at TEXT NOT NULL
);
CREATE INDEX buoy_usage_events_observed ON buoy_usage_events(observed_at);
