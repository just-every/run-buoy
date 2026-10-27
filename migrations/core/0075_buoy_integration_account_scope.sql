-- Existing grants retain their explicit IDs. All-account authority is opt-in.
ALTER TABLE buoy_integration_tokens ADD COLUMN account_scope TEXT NOT NULL DEFAULT 'explicit' CHECK(account_scope IN ('explicit','all'));
-- Earlier issuance instants are unknown; never invent historical metadata.
ALTER TABLE buoy_integration_tokens ADD COLUMN label TEXT NOT NULL DEFAULT 'Integration credential';
ALTER TABLE buoy_integration_tokens ADD COLUMN created_at TEXT;
ALTER TABLE buoy_integration_tokens ADD COLUMN revoked_reason TEXT CHECK(revoked_reason IN ('revocation','account_erasure'));
DROP TRIGGER buoy_integration_account_removed;
CREATE TRIGGER buoy_integration_account_removed BEFORE DELETE ON buoy_accounts
BEGIN
 UPDATE buoy_integration_tokens
 SET revoked_reason=CASE WHEN revoked_at IS NULL THEN 'account_erasure' ELSE revoked_reason END,
     revoked_at=COALESCE(revoked_at,CAST(strftime('%s','now') AS INTEGER)*1000),
     account_ids=(SELECT json_group_array(value) FROM json_each(account_ids) WHERE value<>OLD.id)
 WHERE EXISTS(SELECT 1 FROM json_each(account_ids) WHERE value=OLD.id);
END;
