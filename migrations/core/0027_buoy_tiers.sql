-- SEGMENT-001: owner-defined tier names are portable domain configuration.
CREATE TABLE buoy_tiers (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), document TEXT NOT NULL CHECK(json_valid(document))
);
