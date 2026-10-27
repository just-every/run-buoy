CREATE TABLE buoy_support_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 observed_on TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX buoy_support_history_lookup ON buoy_support_history(account_id,observed_on,id);
INSERT INTO buoy_support_history(account_id,observed_on,document)
 SELECT id,json_extract(document,'$.support.observedAt'),json_extract(document,'$.support')
 FROM buoy_accounts WHERE json_type(document,'$.support')='object';
CREATE TRIGGER buoy_support_insert AFTER INSERT ON buoy_accounts
 WHEN json_type(NEW.document,'$.support')='object' BEGIN
 INSERT INTO buoy_support_history(account_id,observed_on,document)
 VALUES(NEW.id,json_extract(NEW.document,'$.support.observedAt'),json_extract(NEW.document,'$.support'));
END;
CREATE TRIGGER buoy_support_update AFTER UPDATE OF document ON buoy_accounts
 WHEN json_type(NEW.document,'$.support')='object'
 AND json_extract(NEW.document,'$.support') IS NOT json_extract(OLD.document,'$.support') BEGIN
 INSERT INTO buoy_support_history(account_id,observed_on,document)
 VALUES(NEW.id,json_extract(NEW.document,'$.support.observedAt'),json_extract(NEW.document,'$.support'));
END;
CREATE TABLE buoy_configuration_drafts (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)),
 ai_revision TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 published_id TEXT
);
CREATE TABLE buoy_configuration_accounts (
 draft_id TEXT NOT NULL REFERENCES buoy_configuration_drafts(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(draft_id,account_id)
);
CREATE TRIGGER buoy_configuration_erasure BEFORE DELETE ON buoy_accounts BEGIN
 DELETE FROM buoy_configuration_drafts WHERE id IN (
 SELECT draft_id FROM buoy_configuration_accounts WHERE account_id=OLD.id);
END;
CREATE TABLE buoy_configuration_signals (
 id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)),
 published_by TEXT NOT NULL, published_at TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1))
);
-- Retained calculations can share a timestamp. Preserve their insertion order
-- across archive restoration instead of ordering random record identities.
ALTER TABLE buoy_scorecard_history ADD COLUMN observed_seq INTEGER NOT NULL DEFAULT 0;
UPDATE buoy_scorecard_history SET observed_seq=rowid;
CREATE TRIGGER buoy_scorecard_history_sequence AFTER INSERT ON buoy_scorecard_history
 WHEN NEW.observed_seq=0 BEGIN
 UPDATE buoy_scorecard_history SET observed_seq=(SELECT COALESCE(max(observed_seq),0)+1 FROM buoy_scorecard_history) WHERE id=NEW.id;
END;
