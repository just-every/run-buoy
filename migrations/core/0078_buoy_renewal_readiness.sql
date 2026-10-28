-- Employment evidence is explicit and scoped to a current account membership.
CREATE TABLE buoy_stakeholder_status (
 account_id TEXT NOT NULL, person_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','departed')),
 source TEXT NOT NULL, observed_on TEXT NOT NULL, revision TEXT NOT NULL,
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 PRIMARY KEY(account_id,person_id),
 FOREIGN KEY(person_id,account_id) REFERENCES buoy_customer_memberships(person_id,account_id) ON DELETE CASCADE
);
CREATE TABLE buoy_renewal_timelines (
 id TEXT PRIMARY KEY, renewal_id TEXT NOT NULL REFERENCES buoy_renewals(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 customer_id TEXT NOT NULL, staff_id TEXT NOT NULL,
 evidence_proof TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT,
 FOREIGN KEY(customer_id,account_id) REFERENCES buoy_customer_memberships(person_id,account_id) ON DELETE CASCADE
);
CREATE INDEX buoy_renewal_timelines_record ON buoy_renewal_timelines(renewal_id,prepared_at);
ALTER TABLE buoy_agent_ledger RENAME TO buoy_agent_ledger_before_readiness;
CREATE TABLE buoy_agent_ledger (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, token_id TEXT NOT NULL,
 command TEXT NOT NULL CHECK(command IN ('renewals.list','playbook.prepare','renewal.prepare','renewal.readiness','renewal.timeline.prepare','experiment.prepare','experiment.report','commands.read','commands.request','other.route')),
 status TEXT NOT NULL CHECK(status IN ('attempt','succeeded','refused')), reason TEXT NOT NULL,
 spent_minor INTEGER NOT NULL DEFAULT 0 CHECK(spent_minor>=0), occurred_at TEXT NOT NULL
);
INSERT INTO buoy_agent_ledger SELECT * FROM buoy_agent_ledger_before_readiness;
DROP TABLE buoy_agent_ledger_before_readiness;
CREATE INDEX buoy_agent_ledger_time ON buoy_agent_ledger(occurred_at DESC,id);
-- A fresh installation opens its renewal workspace at the readiness lead time.
UPDATE buoy_renewal_settings SET document=json_set(document,'$.leadDays',120)
 WHERE revision='initial' AND json_extract(document,'$.leadDays')=90;

-- Retained linked versions use the installation's existing explicit hold.
CREATE TRIGGER buoy_stakeholder_status_privacy_insert AFTER INSERT ON buoy_stakeholder_status
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_status',json_array(NEW."account_id",NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'status',NEW."status",'source',NEW."source",'observed_on',NEW."observed_on",'revision',NEW."revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_status' AND v.record_key=json_array(NEW."account_id",NEW."person_id") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'status',NEW."status",'source',NEW."source",'observed_on',NEW."observed_on",'revision',NEW."revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_stakeholder_status_privacy_before_update BEFORE UPDATE ON buoy_stakeholder_status
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_status',json_array(OLD."account_id",OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'status',OLD."status",'source',OLD."source",'observed_on',OLD."observed_on",'revision',OLD."revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_status' AND v.record_key=json_array(OLD."account_id",OLD."person_id") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'status',OLD."status",'source',OLD."source",'observed_on',OLD."observed_on",'revision',OLD."revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_stakeholder_status_privacy_after_update AFTER UPDATE ON buoy_stakeholder_status
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_status',json_array(NEW."account_id",NEW."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'status',NEW."status",'source',NEW."source",'observed_on',NEW."observed_on",'revision',NEW."revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at")
 FROM buoy_privacy_holds h WHERE NEW.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_status' AND v.record_key=json_array(NEW."account_id",NEW."person_id") AND v.document=json_object('account_id',NEW."account_id",'person_id',NEW."person_id",'status',NEW."status",'source',NEW."source",'observed_on',NEW."observed_on",'revision',NEW."revision",'recorded_by',NEW."recorded_by",'recorded_at',NEW."recorded_at"));
END;
CREATE TRIGGER buoy_stakeholder_status_privacy_delete BEFORE DELETE ON buoy_stakeholder_status
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_stakeholder_status',json_array(OLD."account_id",OLD."person_id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'status',OLD."status",'source',OLD."source",'observed_on',OLD."observed_on",'revision',OLD."revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at")
 FROM buoy_privacy_holds h WHERE OLD.person_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_stakeholder_status' AND v.record_key=json_array(OLD."account_id",OLD."person_id") AND v.document=json_object('account_id',OLD."account_id",'person_id',OLD."person_id",'status',OLD."status",'source',OLD."source",'observed_on',OLD."observed_on",'revision',OLD."revision",'recorded_by',OLD."recorded_by",'recorded_at',OLD."recorded_at"));
END;
CREATE TRIGGER buoy_renewal_timelines_privacy_insert AFTER INSERT ON buoy_renewal_timelines
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_renewal_timelines',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'renewal_id',NEW."renewal_id",'account_id',NEW."account_id",'customer_id',NEW."customer_id",'staff_id',NEW."staff_id",'evidence_proof',NEW."evidence_proof",'document',NEW."document",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at")
 FROM buoy_privacy_holds h WHERE NEW.customer_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_renewal_timelines' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'renewal_id',NEW."renewal_id",'account_id',NEW."account_id",'customer_id',NEW."customer_id",'staff_id',NEW."staff_id",'evidence_proof',NEW."evidence_proof",'document',NEW."document",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at"));
END;
CREATE TRIGGER buoy_renewal_timelines_privacy_before_update BEFORE UPDATE ON buoy_renewal_timelines
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_renewal_timelines',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'renewal_id',OLD."renewal_id",'account_id',OLD."account_id",'customer_id',OLD."customer_id",'staff_id',OLD."staff_id",'evidence_proof',OLD."evidence_proof",'document',OLD."document",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at")
 FROM buoy_privacy_holds h WHERE OLD.customer_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_renewal_timelines' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'renewal_id',OLD."renewal_id",'account_id',OLD."account_id",'customer_id',OLD."customer_id",'staff_id',OLD."staff_id",'evidence_proof',OLD."evidence_proof",'document',OLD."document",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at"));
END;
CREATE TRIGGER buoy_renewal_timelines_privacy_after_update AFTER UPDATE ON buoy_renewal_timelines
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_renewal_timelines',json_array(NEW."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',NEW."id",'renewal_id',NEW."renewal_id",'account_id',NEW."account_id",'customer_id',NEW."customer_id",'staff_id',NEW."staff_id",'evidence_proof',NEW."evidence_proof",'document',NEW."document",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at")
 FROM buoy_privacy_holds h WHERE NEW.customer_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_renewal_timelines' AND v.record_key=json_array(NEW."id") AND v.document=json_object('id',NEW."id",'renewal_id',NEW."renewal_id",'account_id',NEW."account_id",'customer_id',NEW."customer_id",'staff_id',NEW."staff_id",'evidence_proof',NEW."evidence_proof",'document',NEW."document",'prepared_by',NEW."prepared_by",'prepared_at',NEW."prepared_at",'approved_by',NEW."approved_by",'approved_at',NEW."approved_at"));
END;
CREATE TRIGGER buoy_renewal_timelines_privacy_delete BEFORE DELETE ON buoy_renewal_timelines
BEGIN
 INSERT INTO buoy_privacy_hold_versions(person_id,record_kind,record_key,captured_at,document)
 SELECT h.person_id,'buoy_renewal_timelines',json_array(OLD."id"),strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',OLD."id",'renewal_id',OLD."renewal_id",'account_id',OLD."account_id",'customer_id',OLD."customer_id",'staff_id',OLD."staff_id",'evidence_proof',OLD."evidence_proof",'document',OLD."document",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at")
 FROM buoy_privacy_holds h WHERE OLD.customer_id=h.person_id
 AND NOT EXISTS(SELECT 1 FROM buoy_privacy_hold_versions v WHERE v.person_id=h.person_id AND v.record_kind='buoy_renewal_timelines' AND v.record_key=json_array(OLD."id") AND v.document=json_object('id',OLD."id",'renewal_id',OLD."renewal_id",'account_id',OLD."account_id",'customer_id',OLD."customer_id",'staff_id',OLD."staff_id",'evidence_proof',OLD."evidence_proof",'document',OLD."document",'prepared_by',OLD."prepared_by",'prepared_at',OLD."prepared_at",'approved_by',OLD."approved_by",'approved_at',OLD."approved_at"));
END;
