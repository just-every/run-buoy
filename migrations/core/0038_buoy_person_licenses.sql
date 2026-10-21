-- ADOPT-001: one explicit licensed seat per customer-person membership.
CREATE TABLE buoy_adoption_person_licenses (
 account_id TEXT NOT NULL, person_id TEXT NOT NULL,
 licensed INTEGER NOT NULL CHECK(licensed IN (0,1)),
 source_system TEXT NOT NULL CHECK(source_system='manual'),
 reference TEXT NOT NULL, observed_at TEXT NOT NULL,
 stale_days INTEGER NOT NULL CHECK(stale_days BETWEEN 1 AND 365), updated_at TEXT NOT NULL,
 PRIMARY KEY(account_id,person_id),
 FOREIGN KEY(person_id,account_id) REFERENCES buoy_customer_memberships(person_id,account_id) ON DELETE CASCADE
);
CREATE TABLE buoy_adoption_person_license_history (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document)), recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_adoption_person_license_history_account ON buoy_adoption_person_license_history(account_id,recorded_at,id);
CREATE INDEX buoy_adoption_person_license_history_person ON buoy_adoption_person_license_history(person_id,recorded_at,id);
