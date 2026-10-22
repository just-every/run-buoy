-- Installation-local replay key is product custody and travels with the archive.
CREATE TABLE buoy_privacy_key (singleton INTEGER PRIMARY KEY CHECK(singleton=1), secret TEXT NOT NULL);
INSERT INTO buoy_privacy_key VALUES(1,lower(hex(randomblob(32))));
CREATE TABLE buoy_privacy_requests (
 id TEXT PRIMARY KEY REFERENCES buoy_privacy_receipts(id), subject TEXT NOT NULL,
 verification_method TEXT NOT NULL, received_date TEXT NOT NULL, requester_reference TEXT NOT NULL
);
CREATE TABLE buoy_privacy_holds (
 person_id TEXT PRIMARY KEY REFERENCES buoy_customer_people(id),
 subject TEXT NOT NULL, actor TEXT NOT NULL, recorded_at TEXT NOT NULL, reason TEXT NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot))
);
-- Holds have no timer or implicit release. Even a different deletion door must
-- preserve the held customer and the sources/accounts that contain its records.
CREATE TRIGGER buoy_privacy_hold_person BEFORE DELETE ON buoy_customer_people
WHEN EXISTS(SELECT 1 FROM buoy_privacy_holds WHERE person_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Customer records are held'); END;
CREATE TRIGGER buoy_privacy_hold_account BEFORE DELETE ON buoy_accounts
WHEN EXISTS(SELECT 1 FROM buoy_customer_memberships m JOIN buoy_privacy_holds h ON h.person_id=m.person_id WHERE m.account_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Account contains held customer records'); END;
CREATE TRIGGER buoy_privacy_hold_source BEFORE DELETE ON buoy_usage_sources
WHEN EXISTS(SELECT 1 FROM buoy_usage_mappings m JOIN buoy_privacy_holds h ON h.person_id=m.person_id WHERE m.source_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'Source contains held customer records'); END;
CREATE TRIGGER buoy_privacy_hold_event BEFORE DELETE ON buoy_usage_events
WHEN EXISTS(SELECT 1 FROM buoy_usage_mappings m JOIN buoy_privacy_holds h ON h.person_id=m.person_id WHERE m.source_id=OLD.source_id AND m.user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'Usage event belongs to held customer records'); END;
