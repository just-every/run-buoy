CREATE TABLE buoy_portal_files (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL,
 plan_revision TEXT NOT NULL,
 filename TEXT NOT NULL,
 media_type TEXT NOT NULL,
 size INTEGER NOT NULL,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL
);
