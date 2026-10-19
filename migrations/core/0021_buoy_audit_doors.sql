-- AUDIT-001: every door that issues a session (email link, invitation,
-- bootstrap, owner claim, owner sign-in link, provider, review, password, dev)
-- writes oa_sessions, so the sign-in record is taken there, in the same
-- transaction, with the person's opaque id and the session kind only.
CREATE TRIGGER buoy_audit_session_issued AFTER INSERT ON oa_sessions BEGIN
 INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at)
  VALUES(lower(hex(randomblob(16))),'person:'||NEW.operator_id,'auth.signed-in','person:'||NEW.operator_id,NEW.kind||' session issued',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
-- Every installation archive export (rer export, actor 'direct' for the
-- checkout's terminal) records its job when the snapshot is taken. The archive
-- holds the audit as it stood before this entry; the next export carries it.
CREATE TRIGGER buoy_audit_export_started AFTER INSERT ON rer_portability_jobs WHEN NEW.kind='export' BEGIN
 INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at)
  VALUES(lower(hex(randomblob(16))),'portability:'||NEW.actor,'data.exported','archive:'||NEW.id,'Installation archive snapshot taken; delivery of the file is not recorded.',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
