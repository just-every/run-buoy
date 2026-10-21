-- Additive subtypes preserve the existing decision ledger and its three broad
-- categories. An expansion/contraction is a renewed category plus this subtype.
CREATE TABLE buoy_decision_outcomes (
 decision_id TEXT PRIMARY KEY REFERENCES buoy_decisions(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('renewed-with-expansion','renewed-with-contraction'))
);
