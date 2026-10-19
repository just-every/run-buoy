-- SEGMENT-001: durable membership intervals; entry proposals share human approval.
CREATE TABLE buoy_segments (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 revision TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_classifications (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 tier TEXT, stage TEXT, tier_manual INTEGER NOT NULL DEFAULT 0, stage_manual INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE buoy_segment_entries (
 id TEXT PRIMARY KEY, segment_id TEXT NOT NULL REFERENCES buoy_segments(id),
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 entered_at TEXT NOT NULL, exited_at TEXT, proposal_id TEXT
);
CREATE UNIQUE INDEX buoy_segment_active ON buoy_segment_entries(segment_id,account_id) WHERE exited_at IS NULL;
