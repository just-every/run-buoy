CREATE TABLE buoy_communications(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES buoy_accounts(id) ON DELETE CASCADE,person_id TEXT REFERENCES buoy_customer_people(id) ON DELETE CASCADE,data_class TEXT NOT NULL CHECK(data_class IN ('emails','tickets')),observed_on TEXT NOT NULL,body TEXT NOT NULL);
CREATE TABLE buoy_communication_scores(account_id TEXT PRIMARY KEY REFERENCES buoy_accounts(id) ON DELETE CASCADE,document TEXT NOT NULL);
CREATE TRIGGER buoy_communication_erasure AFTER DELETE ON buoy_communications BEGIN
 DELETE FROM buoy_communication_scores WHERE account_id=OLD.account_id;
 DELETE FROM buoy_scorecard_history WHERE account_id=OLD.account_id AND json_type(document,'$.inputs.values."communications.score"') IS NOT NULL;
 DELETE FROM buoy_scorecard_results WHERE account_id=OLD.account_id AND json_type(document,'$.inputs.values."communications.score"') IS NOT NULL;
END;
