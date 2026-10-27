-- Older calculations copied imported factor names without their source accounts.
-- Withdraw those derived snapshots; native accounts and published rules remain.
DELETE FROM buoy_scorecard_history WHERE EXISTS (
 SELECT 1 FROM json_each(buoy_scorecard_history.document,'$.inputs.fields')
 WHERE json_extract(value,'$.kind')='migration'
);
DELETE FROM buoy_scorecard_results WHERE EXISTS (
 SELECT 1 FROM json_each(buoy_scorecard_results.document,'$.inputs.fields')
 WHERE json_extract(value,'$.kind')='migration'
);
