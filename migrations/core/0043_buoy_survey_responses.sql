-- Real research responses explicitly recorded by staff. No delivery is inferred.
CREATE TABLE buoy_survey_responses (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 survey_name TEXT NOT NULL CHECK(length(trim(survey_name))>0),
 kind TEXT NOT NULL CHECK(kind IN ('nps','csat')),
 value INTEGER NOT NULL CHECK(typeof(value)='integer' AND ((kind='nps' AND value BETWEEN 0 AND 10) OR (kind='csat' AND value BETWEEN 1 AND 5))),
 observed_at TEXT NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference))>0),
 source_response_id TEXT NOT NULL CHECK(length(trim(source_response_id))>0),
 source_kind TEXT NOT NULL DEFAULT 'staff-recorded' CHECK(source_kind='staff-recorded'),
 account_revision TEXT NOT NULL, result_revision TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 UNIQUE(account_id,person_id,kind,survey_name,source_response_id)
);
CREATE INDEX buoy_survey_responses_account ON buoy_survey_responses(account_id,kind,observed_at,id);
CREATE INDEX buoy_survey_responses_person ON buoy_survey_responses(person_id,observed_at,id);
CREATE TRIGGER buoy_survey_response_immutable_update BEFORE UPDATE ON buoy_survey_responses BEGIN
 SELECT RAISE(ABORT,'Survey responses are immutable');
END;
-- Deletion is allowed only as part of account or respondent erasure. Membership
-- removal retains history; the calculation excludes that former member.
CREATE TRIGGER buoy_survey_response_immutable_delete BEFORE DELETE ON buoy_survey_responses
 WHEN EXISTS(SELECT 1 FROM buoy_accounts WHERE id=OLD.account_id)
 AND EXISTS(SELECT 1 FROM buoy_customer_people WHERE id=OLD.person_id) BEGIN
 SELECT RAISE(ABORT,'Survey responses are immutable');
END;
