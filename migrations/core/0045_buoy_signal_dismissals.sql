-- Preserve exact alert identity without parsing delimiter-bearing IDs.
CREATE TABLE buoy_adoption_alert_notices (
 notice_id TEXT PRIMARY KEY REFERENCES buoy_inbox(id) ON DELETE CASCADE,
 rule_id TEXT NOT NULL REFERENCES buoy_adoption_consumers(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL, episode TEXT NOT NULL
);
INSERT INTO buoy_adoption_alert_notices
 SELECT n.id,s.rule_id,s.account_id,s.person_id,s.episode FROM buoy_inbox n JOIN buoy_adoption_alert_state s
 ON n.person_id=s.person_id AND n.account_id=s.account_id AND n.type='signal'
 AND n.source='adoption:'||s.rule_id||':'||s.account_id||':'||s.person_id||':'||s.episode;
CREATE TRIGGER buoy_adoption_notice_identity AFTER INSERT ON buoy_inbox WHEN NEW.type='signal' BEGIN
 INSERT INTO buoy_adoption_alert_notices
 SELECT NEW.id,s.rule_id,s.account_id,s.person_id,s.episode FROM buoy_adoption_alert_state s
 WHERE NEW.person_id=s.person_id AND NEW.account_id=s.account_id
 AND NEW.source='adoption:'||s.rule_id||':'||s.account_id||':'||s.person_id||':'||s.episode;
END;
CREATE TABLE buoy_adoption_dismissals (
 rule_id TEXT NOT NULL REFERENCES buoy_adoption_consumers(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL, reason TEXT NOT NULL, until TEXT NOT NULL, created_at TEXT NOT NULL,
 notice_id TEXT NOT NULL REFERENCES buoy_inbox(id) ON DELETE CASCADE,
 PRIMARY KEY(rule_id,account_id,person_id)
);
