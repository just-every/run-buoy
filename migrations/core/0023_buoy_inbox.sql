-- NOTIFY-001: one durable inbox event per source and recipient; mail is separate.
CREATE TABLE buoy_inbox (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('mention','assignment','signal','approval')),
 source TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
 created_at TEXT NOT NULL, read_at TEXT, email TEXT NOT NULL DEFAULT 'pending', digest_id TEXT,
 UNIQUE(person_id,source)
);
CREATE INDEX buoy_inbox_person ON buoy_inbox(person_id,created_at);
CREATE TABLE buoy_notification_preferences (
 person_id TEXT PRIMARY KEY, frequency TEXT NOT NULL CHECK(frequency IN ('off','daily','weekly')),
 modes TEXT NOT NULL CHECK(json_valid(modes)), book_cursor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE buoy_digests (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL, period TEXT NOT NULL,
 frequency TEXT NOT NULL, created_at TEXT NOT NULL, email TEXT NOT NULL,
 UNIQUE(person_id,frequency,period)
);
CREATE TABLE buoy_alert_state (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL
);
CREATE TRIGGER buoy_task_assignment_notice AFTER INSERT ON buoy_tasks WHEN NEW.owner_id IS NOT NULL BEGIN
 INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.owner_id,NEW.account_id,'assignment','task:'||NEW.id||':'||NEW.owner_id,NEW.title,'A task was assigned to you.',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER buoy_task_reassignment_notice AFTER UPDATE OF owner_id ON buoy_tasks WHEN NEW.owner_id IS NOT OLD.owner_id AND NEW.completed_at IS NULL BEGIN
 INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.owner_id,NEW.account_id,'assignment','reassignment:'||NEW.id||':'||lower(hex(randomblob(16))),NEW.title,'An open task was reassigned to you.',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER buoy_approval_notice AFTER INSERT ON buoy_proposals BEGIN
 INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
 SELECT lower(hex(randomblob(16))),o.id,NEW.account_id,'approval','proposal:'||NEW.id,'Review '||NEW.kind||' proposal','A prepared proposal awaits owner or administrator approval.',NEW.prepared_at
 FROM oa_operators o WHERE o.status='active' AND o.role IN ('owner','admin');
END;
