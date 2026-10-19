-- AUDIT-001: migrate every retained event before dropping the cascading log.
-- The subject mapping lives only as long as the account. Audit rows have no FK.
CREATE TABLE buoy_audit_subjects (
 account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,
 subject TEXT NOT NULL UNIQUE
);
INSERT INTO buoy_audit_subjects(account_id,subject)
 SELECT id,lower(hex(randomblob(16))) FROM buoy_accounts;
INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at)
 SELECT e.id,e.actor,e.action,s.subject,'',e.occurred_at
 FROM buoy_events e JOIN buoy_audit_subjects s ON s.account_id=e.account_id;
-- Existing actors were kind:id:display-name; keep just kind:id.
UPDATE buoy_audit SET actor=substr(actor,1,instr(actor,':')+instr(substr(actor,instr(actor,':')+1),':')-1)
 WHERE instr(substr(actor,instr(actor,':')+1),':')>0;
DROP TABLE buoy_events;
