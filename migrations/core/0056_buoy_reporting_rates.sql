-- Reporting restatements retain the rate table used, never changing native amounts.
CREATE TABLE buoy_fx_versions (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 published_by TEXT NOT NULL, published_at TEXT NOT NULL
);
CREATE TABLE buoy_fx_current (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 version_id TEXT NOT NULL REFERENCES buoy_fx_versions(id)
);
CREATE TRIGGER buoy_fx_immutable_update BEFORE UPDATE ON buoy_fx_versions BEGIN
 SELECT RAISE(ABORT,'Published rate tables are immutable');
END;
CREATE TRIGGER buoy_fx_immutable_delete BEFORE DELETE ON buoy_fx_versions BEGIN
 SELECT RAISE(ABORT,'Published rate tables are immutable');
END;
