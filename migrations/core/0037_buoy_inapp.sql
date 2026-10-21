-- INAPP-001: content and receipts are portable; server credentials are not.
CREATE TABLE buoy_inapp_campaigns (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 segment_id TEXT NOT NULL REFERENCES buoy_segments(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('announcement','banner','checklist','walkthrough')),
 title TEXT NOT NULL, body TEXT NOT NULL, steps TEXT NOT NULL CHECK(json_valid(steps)),
 max_views INTEGER NOT NULL CHECK(max_views>0), window_hours INTEGER NOT NULL CHECK(window_hours BETWEEN 1 AND 8760),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE buoy_inapp_credentials (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, creator_id TEXT NOT NULL,
 created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT
);
CREATE TABLE buoy_inapp_deliveries (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES buoy_inapp_campaigns(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 source_id TEXT NOT NULL, claim_key TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX buoy_inapp_deliveries_cap ON buoy_inapp_deliveries(campaign_id,person_id,expires_at);
CREATE TABLE buoy_inapp_receipts (
 event_id TEXT PRIMARY KEY REFERENCES buoy_usage_events(id) ON DELETE CASCADE,
 campaign_id TEXT NOT NULL REFERENCES buoy_inapp_campaigns(id) ON DELETE CASCADE,
 delivery_id TEXT REFERENCES buoy_inapp_deliveries(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('view','completion','dismissal')),
 UNIQUE(delivery_id,kind)
);
