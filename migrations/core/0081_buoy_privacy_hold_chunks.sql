CREATE TABLE buoy_privacy_hold_chunks (
 person_id TEXT NOT NULL REFERENCES buoy_privacy_holds(person_id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 document TEXT NOT NULL,
 PRIMARY KEY(person_id,position)
);
