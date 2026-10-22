ALTER TABLE buoy_playbook_runs ADD COLUMN parent_run_id TEXT REFERENCES buoy_playbook_runs(id) ON DELETE CASCADE;
ALTER TABLE buoy_playbook_runs ADD COLUMN parent_step INTEGER;
CREATE UNIQUE INDEX buoy_child_playbook_step ON buoy_playbook_runs(parent_run_id,parent_step) WHERE parent_run_id IS NOT NULL;
