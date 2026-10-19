-- PLAY-002: tasks carry an owner, priority, type and completion outcome.
-- Existing tasks are owned by the person who approved them.
ALTER TABLE buoy_tasks ADD COLUMN owner_id TEXT;
ALTER TABLE buoy_tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent'));
ALTER TABLE buoy_tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'risk' CHECK(type IN ('risk','onboarding','adoption','renewal','expansion','general'));
ALTER TABLE buoy_tasks ADD COLUMN outcome TEXT;
UPDATE buoy_tasks SET owner_id=(SELECT substr(substr(p.approved_by,8),1,instr(substr(p.approved_by,8),':')-1) FROM buoy_proposals p WHERE p.id=buoy_tasks.proposal_id AND p.approved_by LIKE 'person:%');
CREATE INDEX buoy_tasks_owner ON buoy_tasks(owner_id) WHERE completed_at IS NULL;
-- An account's CSM. Reassignment moves the open tasks the previous CSM owned.
CREATE TABLE buoy_account_owners (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL, assigned_at TEXT NOT NULL
);
-- Each person's manager, who receives escalations of their overdue tasks.
CREATE TABLE buoy_people (
 person_id TEXT PRIMARY KEY, manager_id TEXT, CHECK(manager_id IS NULL OR manager_id<>person_id)
);
-- Away periods: inclusive UTC calendar dates, one named cover, no overlap per person.
CREATE TABLE buoy_away (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL, cover_id TEXT NOT NULL,
 starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, recorded_at TEXT NOT NULL,
 CHECK(starts_on<=ends_on), CHECK(cover_id<>person_id)
);
CREATE INDEX buoy_away_person ON buoy_away(person_id, starts_on);
-- In-app reminders and escalations: one per task and kind. email records what the
-- mail provider said, never a delivery it did not report.
CREATE TABLE buoy_notifications (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
 task_id TEXT NOT NULL REFERENCES buoy_tasks(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('due-soon','due-today','escalated')),
 on_date TEXT NOT NULL, created_at TEXT NOT NULL,
 email TEXT NOT NULL CHECK(email IN ('pending','accepted','failed','uncertain','development','no-provider','no-recipient')),
 UNIQUE(task_id, kind)
);
CREATE INDEX buoy_notifications_person ON buoy_notifications(person_id, created_at);
