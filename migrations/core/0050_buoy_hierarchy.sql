-- Relationships are full native account records, with the same existing fields,
-- usage, revenue, health, ownership, approvals, erasure and account doors.
CREATE TABLE buoy_account_hierarchy (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 parent_id TEXT REFERENCES buoy_accounts(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('account','relationship')),
 CHECK(parent_id IS NOT account_id)
);
CREATE INDEX buoy_hierarchy_parent ON buoy_account_hierarchy(parent_id);
CREATE TABLE buoy_account_staff (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 account_executive_id TEXT, executive_sponsor_id TEXT, support_owner_id TEXT
);
CREATE TABLE buoy_stakeholder_roles (
 account_id TEXT NOT NULL, person_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('champion','executive-sponsor','economic-buyer','admin','billing-contact','end-user')),
 PRIMARY KEY(account_id,person_id,role),
 FOREIGN KEY(person_id,account_id) REFERENCES buoy_customer_memberships(person_id,account_id) ON DELETE CASCADE
);
CREATE TABLE buoy_hierarchy_history (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 old_value TEXT NOT NULL CHECK(json_valid(old_value)), new_value TEXT NOT NULL CHECK(json_valid(new_value)),
 actor TEXT NOT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE buoy_hierarchy_history_people (
 history_id TEXT NOT NULL REFERENCES buoy_hierarchy_history(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 PRIMARY KEY(history_id,person_id)
);
CREATE TABLE buoy_hierarchy_history_accounts (
 history_id TEXT NOT NULL REFERENCES buoy_hierarchy_history(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(history_id,account_id)
);
CREATE TRIGGER buoy_stakeholder_person_erasure BEFORE DELETE ON buoy_customer_people BEGIN
 DELETE FROM buoy_hierarchy_history WHERE id IN(SELECT history_id FROM buoy_hierarchy_history_people WHERE person_id=OLD.id);
END;
-- Erasing one organization never silently erases its child accounts. Explicitly
-- detach children (keeping full native records) before the parent goes away.
CREATE TRIGGER buoy_hierarchy_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_hierarchy_history WHERE id IN(SELECT history_id FROM buoy_hierarchy_history_accounts WHERE account_id=OLD.id);
 UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN(SELECT account_id FROM buoy_account_hierarchy WHERE parent_id=OLD.id);
 UPDATE buoy_account_hierarchy SET parent_id=NULL WHERE parent_id=OLD.id;
END;
CREATE TABLE buoy_scorecard_assignments (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES buoy_scorecard_versions(id),
 revision TEXT NOT NULL, assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL
);

CREATE TABLE buoy_workspace_view_accounts (
 view_id TEXT NOT NULL REFERENCES buoy_workspace_views(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(view_id,account_id)
);
INSERT OR IGNORE INTO buoy_workspace_view_accounts
 SELECT v.id,a.id FROM buoy_workspace_views v JOIN buoy_accounts a
 WHERE json_extract(v.document,'$.kind')='account' AND EXISTS(
  SELECT 1 FROM json_each(v.document,'$.rules.conditions') c
  WHERE (json_extract(c.value,'$.field')='id' AND json_extract(c.value,'$.value')=a.id)
     OR (json_extract(c.value,'$.field')='name' AND json_extract(c.value,'$.value')=json_extract(a.document,'$.name'))
 );
CREATE TRIGGER buoy_workspace_view_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_workspace_views WHERE id IN(SELECT view_id FROM buoy_workspace_view_accounts WHERE account_id=OLD.id);
END;
