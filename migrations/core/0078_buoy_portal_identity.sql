-- Customer classification belongs to the identity, even before its first share.
INSERT OR IGNORE INTO buoy_portal_recipients(operator_id,email)
 SELECT o.id,r.email FROM oa_operators o JOIN buoy_portal_recipients r ON r.email=o.email
 WHERE r.operator_id LIKE 'pending:%';

CREATE TRIGGER buoy_portal_invited_identity AFTER INSERT ON oa_operators
 WHEN EXISTS(SELECT 1 FROM buoy_portal_recipients WHERE email=NEW.email)
 BEGIN
 INSERT OR IGNORE INTO buoy_portal_recipients(operator_id,email) VALUES(NEW.id,NEW.email);
END;

-- Removing a temporary staff assignment cannot resurrect old customer access.
UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE revoked_at IS NULL AND operator_id IN(SELECT person_id FROM buoy_role_assignments);

CREATE TRIGGER buoy_portal_profile_assigned AFTER INSERT ON buoy_role_assignments BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE operator_id=NEW.person_id AND revoked_at IS NULL;
END;

CREATE TRIGGER buoy_portal_profile_updated AFTER UPDATE ON buoy_role_assignments BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE operator_id IN(OLD.person_id,NEW.person_id) AND revoked_at IS NULL;
END;

CREATE TRIGGER buoy_portal_profile_removed AFTER DELETE ON buoy_role_assignments BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE operator_id=OLD.person_id AND revoked_at IS NULL;
END;

CREATE TRIGGER buoy_portal_email_withdrawal AFTER UPDATE OF email ON oa_operators
 WHEN OLD.email<>NEW.email
 BEGIN
 UPDATE buoy_portal_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE operator_id=NEW.id AND revoked_at IS NULL;
END;
