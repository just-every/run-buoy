-- Account erasure also removes the identity from its server intake grants.
CREATE TRIGGER buoy_playbook_intake_account_erasure BEFORE DELETE ON buoy_accounts BEGIN
 UPDATE buoy_playbook_credentials
 SET account_ids=(SELECT json_group_array(value) FROM json_each(account_ids) WHERE value<>OLD.id)
 WHERE EXISTS(SELECT 1 FROM json_each(account_ids) WHERE value=OLD.id);
 UPDATE buoy_playbook_credentials
 SET revoked_at=COALESCE(revoked_at,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 WHERE json_array_length(account_ids)=0;
END;
