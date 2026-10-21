-- Source-backed score histories inherit account/person erasure. A retained
-- portfolio formula depends on every account in its recorded portfolio.
UPDATE buoy_scorecard_history SET document=json_set(document,'$.inputs.sourceAccountIds',json(
 CASE WHEN EXISTS(SELECT 1 FROM json_tree(document,'$.inputs.sources') WHERE key='explanation' AND value LIKE '%Portfolio %')
 THEN (SELECT json_group_array(id) FROM (SELECT id FROM buoy_accounts ORDER BY id)) ELSE json_array(account_id) END))
 WHERE json_type(document,'$.inputs.sourceAccountIds') IS NULL;
UPDATE buoy_scorecard_results SET document=json_set(document,'$.inputs.sourceAccountIds',json(
 CASE WHEN EXISTS(SELECT 1 FROM json_tree(document,'$.inputs.sources') WHERE key='explanation' AND value LIKE '%Portfolio %')
 THEN (SELECT json_group_array(id) FROM (SELECT id FROM buoy_accounts ORDER BY id)) ELSE json_array(account_id) END))
 WHERE json_type(document,'$.inputs.sourceAccountIds') IS NULL;
CREATE TRIGGER buoy_scorecard_account_source_erasure BEFORE DELETE ON buoy_accounts BEGIN
 UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id<>OLD.id AND id IN (
  SELECT account_id FROM buoy_scorecard_results r WHERE EXISTS(SELECT 1 FROM json_each(r.document,'$.inputs.sourceAccountIds') WHERE value=OLD.id)
 );
 DELETE FROM buoy_scorecard_history WHERE EXISTS(SELECT 1 FROM json_each(buoy_scorecard_history.document,'$.inputs.sourceAccountIds') WHERE value=OLD.id);
 DELETE FROM buoy_scorecard_results WHERE EXISTS(SELECT 1 FROM json_each(buoy_scorecard_results.document,'$.inputs.sourceAccountIds') WHERE value=OLD.id);
END;
CREATE TRIGGER buoy_scorecard_person_source_erasure BEFORE DELETE ON buoy_customer_people BEGIN
 UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN (
  SELECT account_id FROM buoy_scorecard_results r WHERE EXISTS(SELECT 1 FROM json_each(r.document,'$.inputs.sourcePersonIds') WHERE value=OLD.id)
 );
 DELETE FROM buoy_scorecard_history WHERE EXISTS(SELECT 1 FROM json_each(buoy_scorecard_history.document,'$.inputs.sourcePersonIds') WHERE value=OLD.id);
 DELETE FROM buoy_scorecard_results WHERE EXISTS(SELECT 1 FROM json_each(buoy_scorecard_results.document,'$.inputs.sourcePersonIds') WHERE value=OLD.id);
END;
