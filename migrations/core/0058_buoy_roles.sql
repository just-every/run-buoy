-- Product permissions overlay native identities; native owner/admin roles remain unchanged.
CREATE TABLE buoy_role_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision TEXT NOT NULL
);
INSERT INTO buoy_role_settings VALUES(1,'initial');
CREATE TABLE buoy_role_definitions (
 id TEXT PRIMARY KEY, name TEXT NOT NULL,
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE buoy_role_assignments (
 person_id TEXT PRIMARY KEY REFERENCES oa_operators(id) ON DELETE CASCADE,
 native_version INTEGER NOT NULL,
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
