CREATE TABLE buoy_onboarding_projects (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 revision TEXT NOT NULL,
 created_at TEXT NOT NULL
);
ALTER TABLE buoy_tasks ADD COLUMN onboarding_project_id TEXT REFERENCES buoy_onboarding_projects(id) ON DELETE CASCADE;
ALTER TABLE buoy_tasks ADD COLUMN customer_person_id TEXT REFERENCES buoy_customer_people(id) ON DELETE SET NULL;
