-- Customer contacts and product users are separate from installation operators.
CREATE TABLE buoy_customer_people (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('contact','user')),
 name TEXT NOT NULL, revision TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE buoy_customer_memberships (
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(person_id,account_id)
);
CREATE INDEX buoy_customer_memberships_account ON buoy_customer_memberships(account_id,person_id);
CREATE TABLE buoy_customer_fields (
 key TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)), revision TEXT NOT NULL
);
CREATE TABLE buoy_customer_values (
 person_id TEXT PRIMARY KEY REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE buoy_customer_results (
 person_id TEXT PRIMARY KEY REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 document TEXT NOT NULL CHECK(json_valid(document))
);
-- A value's explicitly supplied source account, or its source person's current
-- memberships, owns its source custody. Erasure must remove those inputs too.
CREATE TABLE buoy_customer_value_sources (
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(person_id,field_key,account_id)
);
CREATE TABLE buoy_customer_result_accounts (
 person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(person_id,field_key,account_id)
);
CREATE TABLE buoy_customer_history (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES buoy_customer_people(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL, old_value TEXT NOT NULL CHECK(json_valid(old_value)),
 new_value TEXT NOT NULL CHECK(json_valid(new_value)), actor TEXT NOT NULL,
 source TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE INDEX buoy_customer_history_person ON buoy_customer_history(person_id,recorded_at);
CREATE TABLE buoy_customer_history_accounts (
 history_id TEXT NOT NULL REFERENCES buoy_customer_history(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(history_id,account_id)
);
CREATE TRIGGER buoy_customer_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_customer_people WHERE id IN (
  SELECT person_id FROM buoy_customer_memberships WHERE account_id=OLD.id
 ) AND NOT EXISTS (
  SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=buoy_customer_people.id AND m.account_id<>OLD.id
 );
 DELETE FROM buoy_customer_history WHERE id IN (
  SELECT history_id FROM buoy_customer_history_accounts WHERE account_id=OLD.id
 );
 UPDATE buoy_customer_values SET document=(
  SELECT json_group_object(j.key,CASE WHEN j.type IN ('array','object') THEN json(j.value)
   WHEN j.type='true' THEN json('true') WHEN j.type='false' THEN json('false') ELSE j.value END)
  FROM json_each(buoy_customer_values.document) j WHERE NOT EXISTS (
   SELECT 1 FROM buoy_customer_value_sources s WHERE s.person_id=buoy_customer_values.person_id
    AND s.field_key=j.key AND s.account_id=OLD.id
  )
 ) WHERE person_id IN (SELECT person_id FROM buoy_customer_value_sources WHERE account_id=OLD.id);
 -- Results are recomputed from the remaining records before a successful
 -- erasure response; do not expose an old account's input in the meantime.
 UPDATE buoy_customer_results SET document=(
  SELECT json_group_object(j.key,CASE WHEN j.type IN ('array','object') THEN json(j.value)
   WHEN j.type='true' THEN json('true') WHEN j.type='false' THEN json('false') ELSE j.value END)
  FROM json_each(buoy_customer_results.document) j
  WHERE NOT EXISTS (SELECT 1 FROM buoy_customer_result_accounts r WHERE r.person_id=buoy_customer_results.person_id AND r.field_key=j.key AND r.account_id=OLD.id)
   AND NOT EXISTS (SELECT 1 FROM buoy_customer_value_sources s WHERE s.person_id=buoy_customer_results.person_id AND s.field_key=j.key AND s.account_id=OLD.id)
 );
 UPDATE buoy_customer_people SET revision=lower(hex(randomblob(16)))
 WHERE id IN (SELECT person_id FROM buoy_customer_memberships WHERE account_id=OLD.id);
END;
