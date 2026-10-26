-- This product marker carries no consent, provider policy or execution authority.
CREATE TABLE buoy_communication_state (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 configured INTEGER NOT NULL CHECK(configured IN (0,1))
);
INSERT INTO buoy_communication_state(singleton,configured)
 SELECT 1, CASE WHEN json_type(document,'$.communicationsEnabled') IS NULL THEN 0 ELSE 1 END
 FROM buoy_ai_settings WHERE singleton=1;
