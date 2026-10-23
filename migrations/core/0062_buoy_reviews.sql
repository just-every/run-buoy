CREATE TABLE buoy_reviews (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL,
 reviewed_revision TEXT, reviewed_by TEXT, reviewed_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_review_meetings (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES buoy_reviews(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 operation_key TEXT NOT NULL UNIQUE, input TEXT NOT NULL CHECK(json_valid(input)),
 receipt TEXT NOT NULL CHECK(json_valid(receipt)), recorded_at TEXT NOT NULL
);
CREATE TABLE buoy_review_people (
 review_id TEXT NOT NULL REFERENCES buoy_reviews(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 PRIMARY KEY(review_id,person_id)
);
-- A captured deck follows the people whose linked source facts it may contain.
CREATE TRIGGER buoy_review_person_erasure BEFORE DELETE ON buoy_customer_people BEGIN
 DELETE FROM buoy_reviews WHERE id IN (SELECT review_id FROM buoy_review_people WHERE person_id=OLD.id);
END;
