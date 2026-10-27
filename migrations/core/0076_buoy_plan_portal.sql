-- Portal identity separation survives revocation; grants never enter archives.
CREATE TABLE buoy_portal_recipients (
 operator_id TEXT PRIMARY KEY,
 email TEXT NOT NULL
);
CREATE TABLE buoy_portal_grants (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 plan_revision TEXT NOT NULL,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL,
 operator_version INTEGER NOT NULL,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL,
 revision TEXT NOT NULL,
 task_ids TEXT NOT NULL CHECK(json_valid(task_ids)),
 expires_at INTEGER NOT NULL,
 revoked_at TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE buoy_plan_confirmations (
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 plan_revision TEXT NOT NULL,
 objective_id TEXT NOT NULL,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL,
 statement TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(plan_id,plan_revision,objective_id)
);
CREATE TABLE buoy_portal_events (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 body TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE TRIGGER buoy_portal_membership_removed AFTER DELETE ON buoy_customer_memberships BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE person_id=OLD.person_id AND account_id=OLD.account_id AND revoked_at IS NULL;
END;
