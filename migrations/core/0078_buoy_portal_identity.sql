-- Customer classification belongs to the identity, even before its first share.
INSERT OR IGNORE INTO buoy_portal_recipients(operator_id,email)
 SELECT o.id,r.email FROM oa_operators o JOIN buoy_portal_recipients r ON r.email=o.email
 WHERE r.operator_id LIKE 'pending:%';

CREATE TRIGGER buoy_portal_invited_identity AFTER INSERT ON oa_operators
 WHEN EXISTS(SELECT 1 FROM buoy_portal_recipients WHERE email=NEW.email)
 BEGIN
 INSERT OR IGNORE INTO buoy_portal_recipients(operator_id,email) VALUES(NEW.id,NEW.email);
END;

CREATE TRIGGER buoy_portal_email_withdrawal AFTER UPDATE OF email ON oa_operators
 WHEN OLD.email<>NEW.email
 BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE operator_id=NEW.id AND revoked_at IS NULL;
END;
