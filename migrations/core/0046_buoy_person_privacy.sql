-- Privacy receipts retain opaque subjects, never names or raw source identities.
CREATE TABLE buoy_customer_subjects (
 person_id TEXT PRIMARY KEY REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 subject TEXT NOT NULL UNIQUE
);
INSERT INTO buoy_customer_subjects SELECT id,lower(hex(randomblob(16))) FROM buoy_customer_people;
UPDATE buoy_audit SET subject=(SELECT subject FROM buoy_customer_subjects WHERE 'customer-person:'||person_id=buoy_audit.subject)
 WHERE EXISTS(SELECT 1 FROM buoy_customer_subjects WHERE 'customer-person:'||person_id=buoy_audit.subject);
CREATE TRIGGER buoy_customer_subject_created AFTER INSERT ON buoy_customer_people BEGIN
 INSERT INTO buoy_customer_subjects VALUES(NEW.id,lower(hex(randomblob(16))));
END;
CREATE TABLE buoy_customer_holders (
 person_id TEXT PRIMARY KEY REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL
);
CREATE TABLE buoy_privacy_receipts (
 id TEXT PRIMARY KEY, subject TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('exported','erased')),
 actor TEXT NOT NULL, recorded_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_erased_usage_identities (
 source_id TEXT NOT NULL REFERENCES buoy_usage_sources(id) ON DELETE CASCADE,
 identity_hash TEXT NOT NULL, PRIMARY KEY(source_id,identity_hash)
);
-- Delete only observations linked to this person's reviewed source/user IDs.
-- This includes group variants still awaiting review, not other source users.
CREATE TRIGGER buoy_customer_person_custody BEFORE DELETE ON buoy_customer_people BEGIN
 DELETE FROM buoy_usage_events WHERE EXISTS (
  SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=OLD.id
   AND m.source_id=buoy_usage_events.source_id AND m.user_id=buoy_usage_events.user_id
 );
 UPDATE buoy_audit SET subject=COALESCE((SELECT subject FROM buoy_customer_subjects WHERE person_id=OLD.id),lower(hex(randomblob(16)))),detail=''
 WHERE subject='customer-person:'||OLD.id;
END;
