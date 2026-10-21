CREATE TABLE buoy_workspace_views (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, shared INTEGER NOT NULL CHECK(shared IN (0,1)),
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_workspace_view_people (
 view_id TEXT NOT NULL REFERENCES buoy_workspace_views(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 PRIMARY KEY(view_id,person_id)
);
CREATE TRIGGER buoy_workspace_person_erasure BEFORE DELETE ON buoy_customer_people BEGIN
 DELETE FROM buoy_workspace_views WHERE id IN(SELECT view_id FROM buoy_workspace_view_people WHERE person_id=OLD.id);
END;
CREATE TABLE buoy_workspace_bulk (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, input TEXT NOT NULL CHECK(json_valid(input)),
 receipt TEXT NOT NULL CHECK(json_valid(receipt)), recorded_at TEXT NOT NULL
);
CREATE TABLE buoy_workspace_bulk_accounts (
 operation_id TEXT NOT NULL REFERENCES buoy_workspace_bulk(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(operation_id,account_id)
);
CREATE TRIGGER buoy_workspace_bulk_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_workspace_bulk WHERE id IN(SELECT operation_id FROM buoy_workspace_bulk_accounts WHERE account_id=OLD.id);
END;
