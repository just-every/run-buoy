-- Preserve changed and removed linked rows while a customer hold is active.
-- The baseline remains in the hold snapshot. Explicit release removes these
-- retained versions with that hold; time alone never releases custody.
CREATE TABLE buoy_privacy_hold_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 person_id TEXT NOT NULL REFERENCES buoy_privacy_holds(person_id) ON DELETE CASCADE,
 record_kind TEXT NOT NULL, record_key TEXT NOT NULL,
 captured_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX buoy_privacy_hold_versions_person ON buoy_privacy_hold_versions(person_id);
CREATE TRIGGER buoy_customer_people_privacy_insert AFTER INSERT ON buoy_customer_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_people',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'kind',NEW."kind",'name',NEW."name",'revision',NEW."revision",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE NEW.id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_people' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'kind',NEW."kind",'name',NEW."name",'revision',NEW."revision",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_customer_people_privacy_before_update BEFORE UPDATE ON buoy_customer_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_people',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'kind',OLD."kind",'name',OLD."name",'revision',OLD."revision",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE OLD.id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_people' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'kind',OLD."kind",'name',OLD."name",'revision',OLD."revision",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_customer_people_privacy_after_update AFTER UPDATE ON buoy_customer_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_people',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'kind',NEW."kind",'name',NEW."name",'revision',NEW."revision",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE NEW.id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_people' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'kind',NEW."kind",'name',NEW."name",'revision',NEW."revision",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_customer_people_privacy_delete BEFORE DELETE ON buoy_customer_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_people',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'kind',OLD."kind",'name',OLD."name",'revision',OLD."revision",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE OLD.id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_people' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'kind',OLD."kind",'name',OLD."name",'revision',OLD."revision",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_customer_memberships_privacy_insert AFTER INSERT ON buoy_customer_memberships
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_memberships',json_array(NEW."person_id",NEW."account_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'account_id',NEW."account_id")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_memberships' AND v.record_key=json_array(NEW."person_id",NEW."account_id") AND v.document=json_object('person_id',NEW."person_id",'account_id',NEW."account_id"));
END;
CREATE TRIGGER buoy_customer_memberships_privacy_before_update BEFORE UPDATE ON buoy_customer_memberships
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_memberships',json_array(OLD."person_id",OLD."account_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'account_id',OLD."account_id")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_memberships' AND v.record_key=json_array(OLD."person_id",OLD."account_id") AND v.document=json_object('person_id',OLD."person_id",'account_id',OLD."account_id"));
END;
CREATE TRIGGER buoy_customer_memberships_privacy_after_update AFTER UPDATE ON buoy_customer_memberships
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_memberships',json_array(NEW."person_id",NEW."account_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'account_id',NEW."account_id")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_memberships' AND v.record_key=json_array(NEW."person_id",NEW."account_id") AND v.document=json_object('person_id',NEW."person_id",'account_id',NEW."account_id"));
END;
CREATE TRIGGER buoy_customer_memberships_privacy_delete BEFORE DELETE ON buoy_customer_memberships
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_memberships',json_array(OLD."person_id",OLD."account_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'account_id',OLD."account_id")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_memberships' AND v.record_key=json_array(OLD."person_id",OLD."account_id") AND v.document=json_object('person_id',OLD."person_id",'account_id',OLD."account_id"));
END;
CREATE TRIGGER buoy_customer_values_privacy_insert AFTER INSERT ON buoy_customer_values
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_values',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_values' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document"));
END;
CREATE TRIGGER buoy_customer_values_privacy_before_update BEFORE UPDATE ON buoy_customer_values
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_values',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_values' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document"));
END;
CREATE TRIGGER buoy_customer_values_privacy_after_update AFTER UPDATE ON buoy_customer_values
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_values',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_values' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document"));
END;
CREATE TRIGGER buoy_customer_values_privacy_delete BEFORE DELETE ON buoy_customer_values
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_values',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_values' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document"));
END;
CREATE TRIGGER buoy_customer_results_privacy_insert AFTER INSERT ON buoy_customer_results
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_results',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_results' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document"));
END;
CREATE TRIGGER buoy_customer_results_privacy_before_update BEFORE UPDATE ON buoy_customer_results
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_results',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_results' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document"));
END;
CREATE TRIGGER buoy_customer_results_privacy_after_update AFTER UPDATE ON buoy_customer_results
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_results',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_results' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document"));
END;
CREATE TRIGGER buoy_customer_results_privacy_delete BEFORE DELETE ON buoy_customer_results
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_results',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_results' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document"));
END;
CREATE TRIGGER buoy_customer_history_privacy_insert AFTER INSERT ON buoy_customer_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'person_id',NEW."person_id",'field_key',NEW."field_key",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'person_id',NEW."person_id",'field_key',NEW."field_key",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_customer_history_privacy_before_update BEFORE UPDATE ON buoy_customer_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'person_id',OLD."person_id",'field_key',OLD."field_key",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'person_id',OLD."person_id",'field_key',OLD."field_key",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_customer_history_privacy_after_update AFTER UPDATE ON buoy_customer_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'person_id',NEW."person_id",'field_key',NEW."field_key",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'person_id',NEW."person_id",'field_key',NEW."field_key",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_customer_history_privacy_delete BEFORE DELETE ON buoy_customer_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'person_id',OLD."person_id",'field_key',OLD."field_key",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'person_id',OLD."person_id",'field_key',OLD."field_key",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_customer_holders_privacy_insert AFTER INSERT ON buoy_customer_holders
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_holders',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document",'revision',NEW."revision")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_holders' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document",'revision',NEW."revision"));
END;
CREATE TRIGGER buoy_customer_holders_privacy_before_update BEFORE UPDATE ON buoy_customer_holders
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_holders',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document",'revision',OLD."revision")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_holders' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document",'revision',OLD."revision"));
END;
CREATE TRIGGER buoy_customer_holders_privacy_after_update AFTER UPDATE ON buoy_customer_holders
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_holders',json_array(NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',NEW."person_id",'document',NEW."document",'revision',NEW."revision")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_holders' AND v.record_key=json_array(NEW."person_id") AND v.document=json_object('person_id',NEW."person_id",'document',NEW."document",'revision',NEW."revision"));
END;
CREATE TRIGGER buoy_customer_holders_privacy_delete BEFORE DELETE ON buoy_customer_holders
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_customer_holders',json_array(OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('person_id',OLD."person_id",'document',OLD."document",'revision',OLD."revision")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_customer_holders' AND v.record_key=json_array(OLD."person_id") AND v.document=json_object('person_id',OLD."person_id",'document',OLD."document",'revision',OLD."revision"));
END;
CREATE TRIGGER buoy_survey_responses_privacy_insert AFTER INSERT ON buoy_survey_responses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_survey_responses',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'survey_name',NEW."survey_name",'kind',NEW."kind",'value',NEW."value",'observed_at',NEW."observed_at",'reference',NEW."reference",'source_response_id',NEW."source_response_id",'source_kind',NEW."source_kind",'account_revision',NEW."account_revision",'result_revision',NEW."result_revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_survey_responses' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'survey_name',NEW."survey_name",'kind',NEW."kind",'value',NEW."value",'observed_at',NEW."observed_at",'reference',NEW."reference",'source_response_id',NEW."source_response_id",'source_kind',NEW."source_kind",'account_revision',NEW."account_revision",'result_revision',NEW."result_revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_survey_responses_privacy_before_update BEFORE UPDATE ON buoy_survey_responses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_survey_responses',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'survey_name',OLD."survey_name",'kind',OLD."kind",'value',OLD."value",'observed_at',OLD."observed_at",'reference',OLD."reference",'source_response_id',OLD."source_response_id",'source_kind',OLD."source_kind",'account_revision',OLD."account_revision",'result_revision',OLD."result_revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_survey_responses' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'survey_name',OLD."survey_name",'kind',OLD."kind",'value',OLD."value",'observed_at',OLD."observed_at",'reference',OLD."reference",'source_response_id',OLD."source_response_id",'source_kind',OLD."source_kind",'account_revision',OLD."account_revision",'result_revision',OLD."result_revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_survey_responses_privacy_after_update AFTER UPDATE ON buoy_survey_responses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_survey_responses',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'survey_name',NEW."survey_name",'kind',NEW."kind",'value',NEW."value",'observed_at',NEW."observed_at",'reference',NEW."reference",'source_response_id',NEW."source_response_id",'source_kind',NEW."source_kind",'account_revision',NEW."account_revision",'result_revision',NEW."result_revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_survey_responses' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'survey_name',NEW."survey_name",'kind',NEW."kind",'value',NEW."value",'observed_at',NEW."observed_at",'reference',NEW."reference",'source_response_id',NEW."source_response_id",'source_kind',NEW."source_kind",'account_revision',NEW."account_revision",'result_revision',NEW."result_revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_survey_responses_privacy_delete BEFORE DELETE ON buoy_survey_responses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_survey_responses',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'survey_name',OLD."survey_name",'kind',OLD."kind",'value',OLD."value",'observed_at',OLD."observed_at",'reference',OLD."reference",'source_response_id',OLD."source_response_id",'source_kind',OLD."source_kind",'account_revision',OLD."account_revision",'result_revision',OLD."result_revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_survey_responses' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'survey_name',OLD."survey_name",'kind',OLD."kind",'value',OLD."value",'observed_at',OLD."observed_at",'reference',OLD."reference",'source_response_id',OLD."source_response_id",'source_kind',OLD."source_kind",'account_revision',OLD."account_revision",'result_revision',OLD."result_revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_usage_mappings_privacy_insert AFTER INSERT ON buoy_usage_mappings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_mappings',json_array(NEW."source_id",NEW."claim_key"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('source_id',NEW."source_id",'claim_key',NEW."claim_key",'user_id',NEW."user_id",'group_id',NEW."group_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'revision',NEW."revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_mappings' AND v.record_key=json_array(NEW."source_id",NEW."claim_key") AND v.document=json_object('source_id',NEW."source_id",'claim_key',NEW."claim_key",'user_id',NEW."user_id",'group_id',NEW."group_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'revision',NEW."revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at"));
END;
CREATE TRIGGER buoy_usage_mappings_privacy_before_update BEFORE UPDATE ON buoy_usage_mappings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_mappings',json_array(OLD."source_id",OLD."claim_key"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('source_id',OLD."source_id",'claim_key',OLD."claim_key",'user_id',OLD."user_id",'group_id',OLD."group_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'revision',OLD."revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_mappings' AND v.record_key=json_array(OLD."source_id",OLD."claim_key") AND v.document=json_object('source_id',OLD."source_id",'claim_key',OLD."claim_key",'user_id',OLD."user_id",'group_id',OLD."group_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'revision',OLD."revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at"));
END;
CREATE TRIGGER buoy_usage_mappings_privacy_after_update AFTER UPDATE ON buoy_usage_mappings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_mappings',json_array(NEW."source_id",NEW."claim_key"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('source_id',NEW."source_id",'claim_key',NEW."claim_key",'user_id',NEW."user_id",'group_id',NEW."group_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'revision',NEW."revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_mappings' AND v.record_key=json_array(NEW."source_id",NEW."claim_key") AND v.document=json_object('source_id',NEW."source_id",'claim_key',NEW."claim_key",'user_id',NEW."user_id",'group_id',NEW."group_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'revision',NEW."revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at"));
END;
CREATE TRIGGER buoy_usage_mappings_privacy_delete BEFORE DELETE ON buoy_usage_mappings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_mappings',json_array(OLD."source_id",OLD."claim_key"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('source_id',OLD."source_id",'claim_key',OLD."claim_key",'user_id',OLD."user_id",'group_id',OLD."group_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'revision',OLD."revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_mappings' AND v.record_key=json_array(OLD."source_id",OLD."claim_key") AND v.document=json_object('source_id',OLD."source_id",'claim_key',OLD."claim_key",'user_id',OLD."user_id",'group_id',OLD."group_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'revision',OLD."revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at"));
END;
CREATE TRIGGER buoy_usage_events_privacy_insert AFTER INSERT ON buoy_usage_events
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_events',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'source_id',NEW."source_id",'message_id',NEW."message_id",'type',NEW."type",'event',NEW."event",'user_id',NEW."user_id",'group_id',NEW."group_id",'observed_at',NEW."observed_at",'received_at',NEW."received_at",'source_reference',NEW."source_reference",'source_system',NEW."source_system",'payload',NEW."payload")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=h.person_id AND m.source_id=NEW.source_id AND m.user_id=NEW.user_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_events' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'source_id',NEW."source_id",'message_id',NEW."message_id",'type',NEW."type",'event',NEW."event",'user_id',NEW."user_id",'group_id',NEW."group_id",'observed_at',NEW."observed_at",'received_at',NEW."received_at",'source_reference',NEW."source_reference",'source_system',NEW."source_system",'payload',NEW."payload"));
END;
CREATE TRIGGER buoy_usage_events_privacy_before_update BEFORE UPDATE ON buoy_usage_events
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_events',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'source_id',OLD."source_id",'message_id',OLD."message_id",'type',OLD."type",'event',OLD."event",'user_id',OLD."user_id",'group_id',OLD."group_id",'observed_at',OLD."observed_at",'received_at',OLD."received_at",'source_reference',OLD."source_reference",'source_system',OLD."source_system",'payload',OLD."payload")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=h.person_id AND m.source_id=OLD.source_id AND m.user_id=OLD.user_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_events' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'source_id',OLD."source_id",'message_id',OLD."message_id",'type',OLD."type",'event',OLD."event",'user_id',OLD."user_id",'group_id',OLD."group_id",'observed_at',OLD."observed_at",'received_at',OLD."received_at",'source_reference',OLD."source_reference",'source_system',OLD."source_system",'payload',OLD."payload"));
END;
CREATE TRIGGER buoy_usage_events_privacy_after_update AFTER UPDATE ON buoy_usage_events
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_events',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'source_id',NEW."source_id",'message_id',NEW."message_id",'type',NEW."type",'event',NEW."event",'user_id',NEW."user_id",'group_id',NEW."group_id",'observed_at',NEW."observed_at",'received_at',NEW."received_at",'source_reference',NEW."source_reference",'source_system',NEW."source_system",'payload',NEW."payload")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=h.person_id AND m.source_id=NEW.source_id AND m.user_id=NEW.user_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_events' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'source_id',NEW."source_id",'message_id',NEW."message_id",'type',NEW."type",'event',NEW."event",'user_id',NEW."user_id",'group_id',NEW."group_id",'observed_at',NEW."observed_at",'received_at',NEW."received_at",'source_reference',NEW."source_reference",'source_system',NEW."source_system",'payload',NEW."payload"));
END;
CREATE TRIGGER buoy_usage_events_privacy_delete BEFORE DELETE ON buoy_usage_events
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_usage_events',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'source_id',OLD."source_id",'message_id',OLD."message_id",'type',OLD."type",'event',OLD."event",'user_id',OLD."user_id",'group_id',OLD."group_id",'observed_at',OLD."observed_at",'received_at',OLD."received_at",'source_reference',OLD."source_reference",'source_system',OLD."source_system",'payload',OLD."payload")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=h.person_id AND m.source_id=OLD.source_id AND m.user_id=OLD.user_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_usage_events' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'source_id',OLD."source_id",'message_id',OLD."message_id",'type',OLD."type",'event',OLD."event",'user_id',OLD."user_id",'group_id',OLD."group_id",'observed_at',OLD."observed_at",'received_at',OLD."received_at",'source_reference',OLD."source_reference",'source_system',OLD."source_system",'payload',OLD."payload"));
END;
CREATE TRIGGER buoy_inapp_deliveries_privacy_insert AFTER INSERT ON buoy_inapp_deliveries
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_deliveries',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'campaign_id',NEW."campaign_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'source_id',NEW."source_id",'claim_key',NEW."claim_key",'created_at',NEW."created_at",'expires_at',NEW."expires_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_deliveries' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'campaign_id',NEW."campaign_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'source_id',NEW."source_id",'claim_key',NEW."claim_key",'created_at',NEW."created_at",'expires_at',NEW."expires_at"));
END;
CREATE TRIGGER buoy_inapp_deliveries_privacy_before_update BEFORE UPDATE ON buoy_inapp_deliveries
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_deliveries',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'campaign_id',OLD."campaign_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'source_id',OLD."source_id",'claim_key',OLD."claim_key",'created_at',OLD."created_at",'expires_at',OLD."expires_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_deliveries' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'campaign_id',OLD."campaign_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'source_id',OLD."source_id",'claim_key',OLD."claim_key",'created_at',OLD."created_at",'expires_at',OLD."expires_at"));
END;
CREATE TRIGGER buoy_inapp_deliveries_privacy_after_update AFTER UPDATE ON buoy_inapp_deliveries
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_deliveries',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'campaign_id',NEW."campaign_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'source_id',NEW."source_id",'claim_key',NEW."claim_key",'created_at',NEW."created_at",'expires_at',NEW."expires_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_deliveries' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'campaign_id',NEW."campaign_id",'account_id',NEW."account_id",'person_id',NEW."person_id",'source_id',NEW."source_id",'claim_key',NEW."claim_key",'created_at',NEW."created_at",'expires_at',NEW."expires_at"));
END;
CREATE TRIGGER buoy_inapp_deliveries_privacy_delete BEFORE DELETE ON buoy_inapp_deliveries
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_deliveries',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'campaign_id',OLD."campaign_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'source_id',OLD."source_id",'claim_key',OLD."claim_key",'created_at',OLD."created_at",'expires_at',OLD."expires_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_deliveries' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'campaign_id',OLD."campaign_id",'account_id',OLD."account_id",'person_id',OLD."person_id",'source_id',OLD."source_id",'claim_key',OLD."claim_key",'created_at',OLD."created_at",'expires_at',OLD."expires_at"));
END;
CREATE TRIGGER buoy_inapp_receipts_privacy_insert AFTER INSERT ON buoy_inapp_receipts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_receipts',json_array(NEW."event_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('event_id',NEW."event_id",'campaign_id',NEW."campaign_id",'delivery_id',NEW."delivery_id",'kind',NEW."kind")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id=e.user_id WHERE e.id=NEW.event_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_receipts' AND v.record_key=json_array(NEW."event_id") AND v.document=json_object('event_id',NEW."event_id",'campaign_id',NEW."campaign_id",'delivery_id',NEW."delivery_id",'kind',NEW."kind"));
END;
CREATE TRIGGER buoy_inapp_receipts_privacy_before_update BEFORE UPDATE ON buoy_inapp_receipts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_receipts',json_array(OLD."event_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('event_id',OLD."event_id",'campaign_id',OLD."campaign_id",'delivery_id',OLD."delivery_id",'kind',OLD."kind")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id=e.user_id WHERE e.id=OLD.event_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_receipts' AND v.record_key=json_array(OLD."event_id") AND v.document=json_object('event_id',OLD."event_id",'campaign_id',OLD."campaign_id",'delivery_id',OLD."delivery_id",'kind',OLD."kind"));
END;
CREATE TRIGGER buoy_inapp_receipts_privacy_after_update AFTER UPDATE ON buoy_inapp_receipts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_receipts',json_array(NEW."event_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('event_id',NEW."event_id",'campaign_id',NEW."campaign_id",'delivery_id',NEW."delivery_id",'kind',NEW."kind")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id=e.user_id WHERE e.id=NEW.event_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_receipts' AND v.record_key=json_array(NEW."event_id") AND v.document=json_object('event_id',NEW."event_id",'campaign_id',NEW."campaign_id",'delivery_id',NEW."delivery_id",'kind',NEW."kind"));
END;
CREATE TRIGGER buoy_inapp_receipts_privacy_delete BEFORE DELETE ON buoy_inapp_receipts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_inapp_receipts',json_array(OLD."event_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('event_id',OLD."event_id",'campaign_id',OLD."campaign_id",'delivery_id',OLD."delivery_id",'kind',OLD."kind")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id=e.user_id WHERE e.id=OLD.event_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_inapp_receipts' AND v.record_key=json_array(OLD."event_id") AND v.document=json_object('event_id',OLD."event_id",'campaign_id',OLD."campaign_id",'delivery_id',OLD."delivery_id",'kind',OLD."kind"));
END;
CREATE TRIGGER buoy_adoption_person_licenses_privacy_insert AFTER INSERT ON buoy_adoption_person_licenses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_licenses',json_array(NEW."account_id",NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'licensed',NEW."licensed",'source_system',NEW."source_system",'reference',NEW."reference",'observed_at',NEW."observed_at",'stale_days',NEW."stale_days",'updated_at',NEW."updated_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_licenses' AND v.record_key=json_array(NEW."account_id",NEW."person_id") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'licensed',NEW."licensed",'source_system',NEW."source_system",'reference',NEW."reference",'observed_at',NEW."observed_at",'stale_days',NEW."stale_days",'updated_at',NEW."updated_at"));
END;
CREATE TRIGGER buoy_adoption_person_licenses_privacy_before_update BEFORE UPDATE ON buoy_adoption_person_licenses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_licenses',json_array(OLD."account_id",OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'licensed',OLD."licensed",'source_system',OLD."source_system",'reference',OLD."reference",'observed_at',OLD."observed_at",'stale_days',OLD."stale_days",'updated_at',OLD."updated_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_licenses' AND v.record_key=json_array(OLD."account_id",OLD."person_id") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'licensed',OLD."licensed",'source_system',OLD."source_system",'reference',OLD."reference",'observed_at',OLD."observed_at",'stale_days',OLD."stale_days",'updated_at',OLD."updated_at"));
END;
CREATE TRIGGER buoy_adoption_person_licenses_privacy_after_update AFTER UPDATE ON buoy_adoption_person_licenses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_licenses',json_array(NEW."account_id",NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'licensed',NEW."licensed",'source_system',NEW."source_system",'reference',NEW."reference",'observed_at',NEW."observed_at",'stale_days',NEW."stale_days",'updated_at',NEW."updated_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_licenses' AND v.record_key=json_array(NEW."account_id",NEW."person_id") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'licensed',NEW."licensed",'source_system',NEW."source_system",'reference',NEW."reference",'observed_at',NEW."observed_at",'stale_days',NEW."stale_days",'updated_at',NEW."updated_at"));
END;
CREATE TRIGGER buoy_adoption_person_licenses_privacy_delete BEFORE DELETE ON buoy_adoption_person_licenses
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_licenses',json_array(OLD."account_id",OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'licensed',OLD."licensed",'source_system',OLD."source_system",'reference',OLD."reference",'observed_at',OLD."observed_at",'stale_days',OLD."stale_days",'updated_at',OLD."updated_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_licenses' AND v.record_key=json_array(OLD."account_id",OLD."person_id") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'licensed',OLD."licensed",'source_system',OLD."source_system",'reference',OLD."reference",'observed_at',OLD."observed_at",'stale_days',OLD."stale_days",'updated_at',OLD."updated_at"));
END;
CREATE TRIGGER buoy_adoption_person_license_history_privacy_insert AFTER INSERT ON buoy_adoption_person_license_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_license_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'document',NEW."document",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_license_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'document',NEW."document",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_adoption_person_license_history_privacy_before_update BEFORE UPDATE ON buoy_adoption_person_license_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_license_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'document',OLD."document",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_license_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'document',OLD."document",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_adoption_person_license_history_privacy_after_update AFTER UPDATE ON buoy_adoption_person_license_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_license_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'document',NEW."document",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_license_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'person_id',NEW."person_id",'document',NEW."document",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_adoption_person_license_history_privacy_delete BEFORE DELETE ON buoy_adoption_person_license_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_adoption_person_license_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'document',OLD."document",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_adoption_person_license_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'person_id',OLD."person_id",'document',OLD."document",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_stakeholder_roles_privacy_insert AFTER INSERT ON buoy_stakeholder_roles
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_roles',json_array(NEW."account_id",NEW."person_id",NEW."role"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'role',NEW."role")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_roles' AND v.record_key=json_array(NEW."account_id",NEW."person_id",NEW."role") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'role',NEW."role"));
END;
CREATE TRIGGER buoy_stakeholder_roles_privacy_before_update BEFORE UPDATE ON buoy_stakeholder_roles
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_roles',json_array(OLD."account_id",OLD."person_id",OLD."role"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'role',OLD."role")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_roles' AND v.record_key=json_array(OLD."account_id",OLD."person_id",OLD."role") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'role',OLD."role"));
END;
CREATE TRIGGER buoy_stakeholder_roles_privacy_after_update AFTER UPDATE ON buoy_stakeholder_roles
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_roles',json_array(NEW."account_id",NEW."person_id",NEW."role"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'role',NEW."role")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_roles' AND v.record_key=json_array(NEW."account_id",NEW."person_id",NEW."role") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'role',NEW."role"));
END;
CREATE TRIGGER buoy_stakeholder_roles_privacy_delete BEFORE DELETE ON buoy_stakeholder_roles
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_roles',json_array(OLD."account_id",OLD."person_id",OLD."role"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'role',OLD."role")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_roles' AND v.record_key=json_array(OLD."account_id",OLD."person_id",OLD."role") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'role',OLD."role"));
END;
CREATE TRIGGER buoy_hierarchy_history_privacy_insert AFTER INSERT ON buoy_hierarchy_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_hierarchy_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_hierarchy_history_people p WHERE p.history_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_hierarchy_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_hierarchy_history_privacy_before_update BEFORE UPDATE ON buoy_hierarchy_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_hierarchy_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_hierarchy_history_people p WHERE p.history_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_hierarchy_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_hierarchy_history_privacy_after_update AFTER UPDATE ON buoy_hierarchy_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_hierarchy_history',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_hierarchy_history_people p WHERE p.history_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_hierarchy_history' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'old_value',NEW."old_value",'new_value',NEW."new_value",'actor',NEW."actor",'source',NEW."source",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_hierarchy_history_privacy_delete BEFORE DELETE ON buoy_hierarchy_history
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_hierarchy_history',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_hierarchy_history_people p WHERE p.history_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_hierarchy_history' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'old_value',OLD."old_value",'new_value',OLD."new_value",'actor',OLD."actor",'source',OLD."source",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_workspace_views_privacy_insert AFTER INSERT ON buoy_workspace_views
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_workspace_views',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'owner_id',NEW."owner_id",'shared',NEW."shared",'document',NEW."document",'revision',NEW."revision",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_workspace_view_people p WHERE p.view_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_workspace_views' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'owner_id',NEW."owner_id",'shared',NEW."shared",'document',NEW."document",'revision',NEW."revision",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_workspace_views_privacy_before_update BEFORE UPDATE ON buoy_workspace_views
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_workspace_views',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'owner_id',OLD."owner_id",'shared',OLD."shared",'document',OLD."document",'revision',OLD."revision",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_workspace_view_people p WHERE p.view_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_workspace_views' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'owner_id',OLD."owner_id",'shared',OLD."shared",'document',OLD."document",'revision',OLD."revision",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_workspace_views_privacy_after_update AFTER UPDATE ON buoy_workspace_views
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_workspace_views',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'owner_id',NEW."owner_id",'shared',NEW."shared",'document',NEW."document",'revision',NEW."revision",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_workspace_view_people p WHERE p.view_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_workspace_views' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'owner_id',NEW."owner_id",'shared',NEW."shared",'document',NEW."document",'revision',NEW."revision",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_workspace_views_privacy_delete BEFORE DELETE ON buoy_workspace_views
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_workspace_views',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'owner_id',OLD."owner_id",'shared',OLD."shared",'document',OLD."document",'revision',OLD."revision",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_workspace_view_people p WHERE p.view_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_workspace_views' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'owner_id',OLD."owner_id",'shared',OLD."shared",'document',OLD."document",'revision',OLD."revision",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_reviews_privacy_insert AFTER INSERT ON buoy_reviews
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_reviews',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'document',NEW."document",'revision',NEW."revision",'reviewed_revision',NEW."reviewed_revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at",'created_by',NEW."created_by",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_reviews' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'document',NEW."document",'revision',NEW."revision",'reviewed_revision',NEW."reviewed_revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at",'created_by',NEW."created_by",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_reviews_privacy_before_update BEFORE UPDATE ON buoy_reviews
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_reviews',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'document',OLD."document",'revision',OLD."revision",'reviewed_revision',OLD."reviewed_revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at",'created_by',OLD."created_by",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_reviews' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'document',OLD."document",'revision',OLD."revision",'reviewed_revision',OLD."reviewed_revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at",'created_by',OLD."created_by",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_reviews_privacy_after_update AFTER UPDATE ON buoy_reviews
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_reviews',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'document',NEW."document",'revision',NEW."revision",'reviewed_revision',NEW."reviewed_revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at",'created_by',NEW."created_by",'created_at',NEW."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=NEW.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_reviews' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'document',NEW."document",'revision',NEW."revision",'reviewed_revision',NEW."reviewed_revision",'reviewed_by',NEW."reviewed_by",'reviewed_at',NEW."reviewed_at",'created_by',NEW."created_by",'created_at',NEW."created_at"));
END;
CREATE TRIGGER buoy_reviews_privacy_delete BEFORE DELETE ON buoy_reviews
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_reviews',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'document',OLD."document",'revision',OLD."revision",'reviewed_revision',OLD."reviewed_revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at",'created_by',OLD."created_by",'created_at',OLD."created_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=OLD.id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_reviews' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'document',OLD."document",'revision',OLD."revision",'reviewed_revision',OLD."reviewed_revision",'reviewed_by',OLD."reviewed_by",'reviewed_at',OLD."reviewed_at",'created_by',OLD."created_by",'created_at',OLD."created_at"));
END;
CREATE TRIGGER buoy_review_meetings_privacy_insert AFTER INSERT ON buoy_review_meetings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_review_meetings',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'review_id',NEW."review_id",'account_id',NEW."account_id",'operation_key',NEW."operation_key",'input',NEW."input",'receipt',NEW."receipt",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=NEW.review_id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_review_meetings' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'review_id',NEW."review_id",'account_id',NEW."account_id",'operation_key',NEW."operation_key",'input',NEW."input",'receipt',NEW."receipt",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_review_meetings_privacy_before_update BEFORE UPDATE ON buoy_review_meetings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_review_meetings',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'review_id',OLD."review_id",'account_id',OLD."account_id",'operation_key',OLD."operation_key",'input',OLD."input",'receipt',OLD."receipt",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=OLD.review_id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_review_meetings' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'review_id',OLD."review_id",'account_id',OLD."account_id",'operation_key',OLD."operation_key",'input',OLD."input",'receipt',OLD."receipt",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_review_meetings_privacy_after_update AFTER UPDATE ON buoy_review_meetings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_review_meetings',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'review_id',NEW."review_id",'account_id',NEW."account_id",'operation_key',NEW."operation_key",'input',NEW."input",'receipt',NEW."receipt",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=NEW.review_id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_review_meetings' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'review_id',NEW."review_id",'account_id',NEW."account_id",'operation_key',NEW."operation_key",'input',NEW."input",'receipt',NEW."receipt",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_review_meetings_privacy_delete BEFORE DELETE ON buoy_review_meetings
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_review_meetings',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'review_id',OLD."review_id",'account_id',OLD."account_id",'operation_key',OLD."operation_key",'input',OLD."input",'receipt',OLD."receipt",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_review_people p WHERE p.review_id=OLD.review_id AND p.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_review_meetings' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'review_id',OLD."review_id",'account_id',OLD."account_id",'operation_key',OLD."operation_key",'input',OLD."input",'receipt',OLD."receipt",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_proposals_privacy_insert AFTER INSERT ON buoy_proposals
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_proposals',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'kind',NEW."kind",'account_revision',NEW."account_revision",'snapshot',NEW."snapshot",'payload',NEW."payload",'status',NEW."status",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_proposals' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'kind',NEW."kind",'account_revision',NEW."account_revision",'snapshot',NEW."snapshot",'payload',NEW."payload",'status',NEW."status",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at"));
END;
CREATE TRIGGER buoy_proposals_privacy_before_update BEFORE UPDATE ON buoy_proposals
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_proposals',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'kind',OLD."kind",'account_revision',OLD."account_revision",'snapshot',OLD."snapshot",'payload',OLD."payload",'status',OLD."status",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_proposals' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'kind',OLD."kind",'account_revision',OLD."account_revision",'snapshot',OLD."snapshot",'payload',OLD."payload",'status',OLD."status",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at"));
END;
CREATE TRIGGER buoy_proposals_privacy_after_update AFTER UPDATE ON buoy_proposals
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_proposals',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'kind',NEW."kind",'account_revision',NEW."account_revision",'snapshot',NEW."snapshot",'payload',NEW."payload",'status',NEW."status",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_proposals' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'kind',NEW."kind",'account_revision',NEW."account_revision",'snapshot',NEW."snapshot",'payload',NEW."payload",'status',NEW."status",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at"));
END;
CREATE TRIGGER buoy_proposals_privacy_delete BEFORE DELETE ON buoy_proposals
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_proposals',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'kind',OLD."kind",'account_revision',OLD."account_revision",'snapshot',OLD."snapshot",'payload',OLD."payload",'status',OLD."status",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_proposals' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'kind',OLD."kind",'account_revision',OLD."account_revision",'snapshot',OLD."snapshot",'payload',OLD."payload",'status',OLD."status",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at"));
END;
CREATE TRIGGER buoy_tasks_privacy_insert AFTER INSERT ON buoy_tasks
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_tasks',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'title',NEW."title",'due_date',NEW."due_date",'completed_at',NEW."completed_at",'evidence',NEW."evidence",'owner_id',NEW."owner_id",'priority',NEW."priority",'type',NEW."type",'outcome',NEW."outcome",'renewal_id',NEW."renewal_id")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_tasks' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'title',NEW."title",'due_date',NEW."due_date",'completed_at',NEW."completed_at",'evidence',NEW."evidence",'owner_id',NEW."owner_id",'priority',NEW."priority",'type',NEW."type",'outcome',NEW."outcome",'renewal_id',NEW."renewal_id"));
END;
CREATE TRIGGER buoy_tasks_privacy_before_update BEFORE UPDATE ON buoy_tasks
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_tasks',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'title',OLD."title",'due_date',OLD."due_date",'completed_at',OLD."completed_at",'evidence',OLD."evidence",'owner_id',OLD."owner_id",'priority',OLD."priority",'type',OLD."type",'outcome',OLD."outcome",'renewal_id',OLD."renewal_id")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_tasks' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'title',OLD."title",'due_date',OLD."due_date",'completed_at',OLD."completed_at",'evidence',OLD."evidence",'owner_id',OLD."owner_id",'priority',OLD."priority",'type',OLD."type",'outcome',OLD."outcome",'renewal_id',OLD."renewal_id"));
END;
CREATE TRIGGER buoy_tasks_privacy_after_update AFTER UPDATE ON buoy_tasks
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_tasks',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'title',NEW."title",'due_date',NEW."due_date",'completed_at',NEW."completed_at",'evidence',NEW."evidence",'owner_id',NEW."owner_id",'priority',NEW."priority",'type',NEW."type",'outcome',NEW."outcome",'renewal_id',NEW."renewal_id")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_tasks' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'title',NEW."title",'due_date',NEW."due_date",'completed_at',NEW."completed_at",'evidence',NEW."evidence",'owner_id',NEW."owner_id",'priority',NEW."priority",'type',NEW."type",'outcome',NEW."outcome",'renewal_id',NEW."renewal_id"));
END;
CREATE TRIGGER buoy_tasks_privacy_delete BEFORE DELETE ON buoy_tasks
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_tasks',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'title',OLD."title",'due_date',OLD."due_date",'completed_at',OLD."completed_at",'evidence',OLD."evidence",'owner_id',OLD."owner_id",'priority',OLD."priority",'type',OLD."type",'outcome',OLD."outcome",'renewal_id',OLD."renewal_id")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_tasks' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'title',OLD."title",'due_date',OLD."due_date",'completed_at',OLD."completed_at",'evidence',OLD."evidence",'owner_id',OLD."owner_id",'priority',OLD."priority",'type',OLD."type",'outcome',OLD."outcome",'renewal_id',OLD."renewal_id"));
END;
CREATE TRIGGER buoy_decisions_privacy_insert AFTER INSERT ON buoy_decisions
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_decisions',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'outcome',NEW."outcome",'reason',NEW."reason",'evidence',NEW."evidence",'renewal_date',NEW."renewal_date",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_decisions' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'outcome',NEW."outcome",'reason',NEW."reason",'evidence',NEW."evidence",'renewal_date',NEW."renewal_date",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_decisions_privacy_before_update BEFORE UPDATE ON buoy_decisions
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_decisions',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'outcome',OLD."outcome",'reason',OLD."reason",'evidence',OLD."evidence",'renewal_date',OLD."renewal_date",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_decisions' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'outcome',OLD."outcome",'reason',OLD."reason",'evidence',OLD."evidence",'renewal_date',OLD."renewal_date",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_decisions_privacy_after_update AFTER UPDATE ON buoy_decisions
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_decisions',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'outcome',NEW."outcome",'reason',NEW."reason",'evidence',NEW."evidence",'renewal_date',NEW."renewal_date",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_decisions' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'proposal_id',NEW."proposal_id",'outcome',NEW."outcome",'reason',NEW."reason",'evidence',NEW."evidence",'renewal_date',NEW."renewal_date",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_decisions_privacy_delete BEFORE DELETE ON buoy_decisions
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_decisions',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'outcome',OLD."outcome",'reason',OLD."reason",'evidence',OLD."evidence",'renewal_date',OLD."renewal_date",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_decisions' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'proposal_id',OLD."proposal_id",'outcome',OLD."outcome",'reason',OLD."reason",'evidence',OLD."evidence",'renewal_date',OLD."renewal_date",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_sentiments_privacy_insert AFTER INSERT ON buoy_sentiments
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_sentiments',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'rating',NEW."rating",'reason',NEW."reason",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at",'expires_on',NEW."expires_on")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_sentiments' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'rating',NEW."rating",'reason',NEW."reason",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at",'expires_on',NEW."expires_on"));
END;
CREATE TRIGGER buoy_sentiments_privacy_before_update BEFORE UPDATE ON buoy_sentiments
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_sentiments',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'rating',OLD."rating",'reason',OLD."reason",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at",'expires_on',OLD."expires_on")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_sentiments' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'rating',OLD."rating",'reason',OLD."reason",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at",'expires_on',OLD."expires_on"));
END;
CREATE TRIGGER buoy_sentiments_privacy_after_update AFTER UPDATE ON buoy_sentiments
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_sentiments',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'rating',NEW."rating",'reason',NEW."reason",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at",'expires_on',NEW."expires_on")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_sentiments' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'rating',NEW."rating",'reason',NEW."reason",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at",'expires_on',NEW."expires_on"));
END;
CREATE TRIGGER buoy_sentiments_privacy_delete BEFORE DELETE ON buoy_sentiments
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_sentiments',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'rating',OLD."rating",'reason',OLD."reason",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at",'expires_on',OLD."expires_on")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_sentiments' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'rating',OLD."rating",'reason',OLD."reason",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at",'expires_on',OLD."expires_on"));
END;
CREATE TRIGGER buoy_handovers_privacy_insert AFTER INSERT ON buoy_handovers
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_handovers',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'from_id',NEW."from_id",'to_id',NEW."to_id",'note',NEW."note",'actor_id',NEW."actor_id",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_handovers' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'from_id',NEW."from_id",'to_id',NEW."to_id",'note',NEW."note",'actor_id',NEW."actor_id",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_handovers_privacy_before_update BEFORE UPDATE ON buoy_handovers
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_handovers',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'from_id',OLD."from_id",'to_id',OLD."to_id",'note',OLD."note",'actor_id',OLD."actor_id",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_handovers' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'from_id',OLD."from_id",'to_id',OLD."to_id",'note',OLD."note",'actor_id',OLD."actor_id",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_handovers_privacy_after_update AFTER UPDATE ON buoy_handovers
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_handovers',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'account_id',NEW."account_id",'from_id',NEW."from_id",'to_id',NEW."to_id",'note',NEW."note",'actor_id',NEW."actor_id",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=NEW.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_handovers' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'account_id',NEW."account_id",'from_id',NEW."from_id",'to_id',NEW."to_id",'note',NEW."note",'actor_id',NEW."actor_id",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_handovers_privacy_delete BEFORE DELETE ON buoy_handovers
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_handovers',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'account_id',OLD."account_id",'from_id',OLD."from_id",'to_id',OLD."to_id",'note',OLD."note",'actor_id',OLD."actor_id",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.account_id=OLD.account_id AND m.person_id=h.person_id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_handovers' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'account_id',OLD."account_id",'from_id',OLD."from_id",'to_id',OLD."to_id",'note',OLD."note",'actor_id',OLD."actor_id",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_hierarchy_history_people_privacy_link AFTER INSERT ON buoy_hierarchy_history_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_hierarchy_history',json_array(t.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',t."id",'account_id',t."account_id",'old_value',t."old_value",'new_value',t."new_value",'actor',t."actor",'source',t."source",'recorded_at',t."recorded_at")
 FROM buoy_privacy_holds h JOIN buoy_hierarchy_history t ON t.id=NEW.history_id WHERE h.person_id=NEW.person_id;
END;
CREATE TRIGGER buoy_workspace_view_people_privacy_link AFTER INSERT ON buoy_workspace_view_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_workspace_views',json_array(t.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',t."id",'owner_id',t."owner_id",'shared',t."shared",'document',t."document",'revision',t."revision",'created_at',t."created_at")
 FROM buoy_privacy_holds h JOIN buoy_workspace_views t ON t.id=NEW.view_id WHERE h.person_id=NEW.person_id;
END;
CREATE TRIGGER buoy_review_people_privacy_link AFTER INSERT ON buoy_review_people
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_reviews',json_array(t.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',t."id",'account_id',t."account_id",'document',t."document",'revision',t."revision",'reviewed_revision',t."reviewed_revision",'reviewed_by',t."reviewed_by",'reviewed_at',t."reviewed_at",'created_by',t."created_by",'created_at',t."created_at")
 FROM buoy_privacy_holds h JOIN buoy_reviews t ON t.id=NEW.review_id WHERE h.person_id=NEW.person_id;
END;
CREATE TRIGGER buoy_accounts_privacy_insert AFTER INSERT ON buoy_accounts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_accounts',json_array(NEW.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW.id,'document',NEW.document,'revision',NEW.revision,'created_at',NEW.created_at)
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=h.person_id AND m.account_id=NEW.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_accounts' AND v.record_key=json_array(NEW.id) AND v.document=json_object('id',NEW.id,'document',NEW.document,'revision',NEW.revision,'created_at',NEW.created_at));
END;
CREATE TRIGGER buoy_accounts_privacy_before_update BEFORE UPDATE ON buoy_accounts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_accounts',json_array(OLD.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD.id,'document',OLD.document,'revision',OLD.revision,'created_at',OLD.created_at)
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=h.person_id AND m.account_id=OLD.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_accounts' AND v.record_key=json_array(OLD.id) AND v.document=json_object('id',OLD.id,'document',OLD.document,'revision',OLD.revision,'created_at',OLD.created_at));
END;
CREATE TRIGGER buoy_accounts_privacy_after_update AFTER UPDATE ON buoy_accounts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_accounts',json_array(NEW.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW.id,'document',NEW.document,'revision',NEW.revision,'created_at',NEW.created_at)
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=h.person_id AND m.account_id=NEW.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_accounts' AND v.record_key=json_array(NEW.id) AND v.document=json_object('id',NEW.id,'document',NEW.document,'revision',NEW.revision,'created_at',NEW.created_at));
END;
CREATE TRIGGER buoy_accounts_privacy_delete BEFORE DELETE ON buoy_accounts
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_accounts',json_array(OLD.id),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD.id,'document',OLD.document,'revision',OLD.revision,'created_at',OLD.created_at)
 FROM buoy_privacy_holds h WHERE EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=h.person_id AND m.account_id=OLD.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_accounts' AND v.record_key=json_array(OLD.id) AND v.document=json_object('id',OLD.id,'document',OLD.document,'revision',OLD.revision,'created_at',OLD.created_at));
END;
