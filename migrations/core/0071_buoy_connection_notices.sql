-- Connector notices need no account when the source has not been bound yet.
CREATE TABLE buoy_connection_notices (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES buoy_connections(id),
 person_id TEXT NOT NULL, source TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
 created_at TEXT NOT NULL, read_at TEXT, UNIQUE(person_id,source)
);
