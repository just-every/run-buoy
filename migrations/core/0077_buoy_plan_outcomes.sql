-- Freeze the exact reviewed plan revision for each milestone cohort member.
ALTER TABLE buoy_outcome_accounts ADD COLUMN plan_id TEXT REFERENCES buoy_success_plans(id) ON DELETE CASCADE;
ALTER TABLE buoy_outcome_accounts ADD COLUMN plan_revision TEXT;
ALTER TABLE buoy_outcome_accounts ADD COLUMN plan_objective TEXT;
ALTER TABLE buoy_outcome_accounts ADD COLUMN plan_customer_id TEXT REFERENCES buoy_customer_people(id) ON DELETE CASCADE;
