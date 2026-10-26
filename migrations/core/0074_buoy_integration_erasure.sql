-- Removing an account also withdraws integration grants that name it. Keep
-- only the opaque revoked credential identity; never retain the erased ID.
CREATE TRIGGER buoy_integration_account_removed BEFORE DELETE ON buoy_accounts
BEGIN
 UPDATE buoy_integration_tokens
 SET revoked_at=COALESCE(revoked_at,CAST(strftime('%s','now') AS INTEGER)*1000),
     account_ids=(SELECT json_group_array(value) FROM json_each(account_ids) WHERE value<>OLD.id)
 WHERE EXISTS(SELECT 1 FROM json_each(account_ids) WHERE value=OLD.id);
END;
