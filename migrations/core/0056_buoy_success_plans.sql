-- Staff drafts grant no customer access or confirmation authority.
CREATE TABLE buoy_success_plans (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 revision TEXT NOT NULL,
 staff_owner_id TEXT,
 customer_owner_id TEXT REFERENCES buoy_customer_people(id) ON DELETE SET NULL,
 document TEXT NOT NULL CHECK(json_valid(document)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX buoy_success_plans_account ON buoy_success_plans(account_id);
CREATE TABLE buoy_success_plan_history (
 id TEXT PRIMARY KEY,
 plan_id TEXT NOT NULL REFERENCES buoy_success_plans(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 revision TEXT NOT NULL,
 document TEXT NOT NULL CHECK(json_valid(document)),
 actor_id TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
CREATE TRIGGER buoy_success_plan_handover AFTER UPDATE OF owner_id ON buoy_account_owners
WHEN OLD.owner_id IS NOT NEW.owner_id BEGIN
 UPDATE buoy_success_plans SET staff_owner_id=NEW.owner_id,revision=lower(hex(randomblob(16))),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE account_id=NEW.account_id AND staff_owner_id=OLD.owner_id;
END;
-- Removing a contact membership immediately withdraws its plan ownership.
CREATE TRIGGER buoy_success_plan_membership AFTER DELETE ON buoy_customer_memberships BEGIN
 UPDATE buoy_success_plans SET customer_owner_id=NULL,revision=lower(hex(randomblob(16))),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE account_id=OLD.account_id AND customer_owner_id=OLD.person_id;
END;
