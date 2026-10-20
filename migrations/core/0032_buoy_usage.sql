-- USAGE-001 partial: raw observations only. No user/contact records, membership
-- carriers, mappings or account attribution can ship before ACCOUNT-004.
CREATE TABLE buoy_usage_sources (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('segment','native')),
 reference TEXT NOT NULL, stale_days INTEGER NOT NULL CHECK(stale_days BETWEEN 1 AND 365),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE buoy_usage_credentials (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, scope TEXT NOT NULL CHECK(json_valid(scope)),
 creator_id TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT
);
CREATE TABLE buoy_usage_events (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 message_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('track','identify','group','event')),
 event TEXT, user_id TEXT, group_id TEXT, observed_at TEXT NOT NULL, received_at TEXT NOT NULL,
 source_reference TEXT NOT NULL, source_system TEXT NOT NULL CHECK(source_system IN ('segment','native')),
 payload TEXT NOT NULL CHECK(json_valid(payload)), UNIQUE(source_id,message_id)
);
CREATE INDEX buoy_usage_events_review ON buoy_usage_events(source_id,user_id,group_id);
CREATE INDEX buoy_usage_events_page ON buoy_usage_events(received_at,id);
